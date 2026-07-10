-- MiDMS subscription payment handling without referral credits.
-- This creates owner payment requests and admin-only approval helpers.
-- Run after clinic_subscriptions migration.

create or replace function public.current_profile_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.clinic_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1
$$;

grant execute on function public.current_profile_clinic_id() to authenticated;

create table if not exists public.clinic_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  subscription_id uuid references public.clinic_subscriptions(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  amount numeric not null check (amount > 0),
  payment_method text not null default 'manual',
  payment_reference text,
  owner_note text,
  admin_note text,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_subscription_payments_clinic_idx
on public.clinic_subscription_payments(clinic_id, requested_at desc);

create index if not exists clinic_subscription_payments_status_idx
on public.clinic_subscription_payments(status, requested_at desc);

create unique index if not exists clinic_subscription_payments_one_pending_idx
on public.clinic_subscription_payments(clinic_id)
where status = 'pending_review';

create or replace function public.touch_clinic_subscription_payments_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinic_subscription_payments_touch_updated_at on public.clinic_subscription_payments;
create trigger clinic_subscription_payments_touch_updated_at
before update on public.clinic_subscription_payments
for each row execute function public.touch_clinic_subscription_payments_updated_at();

alter table public.clinic_subscription_payments enable row level security;

drop policy if exists dms_subscription_payments_clinic_read on public.clinic_subscription_payments;
create policy dms_subscription_payments_clinic_read
on public.clinic_subscription_payments
for select
to authenticated
using (clinic_id = public.current_profile_clinic_id());

drop policy if exists dms_subscription_payments_owner_insert on public.clinic_subscription_payments;
create policy dms_subscription_payments_owner_insert
on public.clinic_subscription_payments
for insert
to authenticated
with check (clinic_id = public.current_profile_clinic_id());

grant select on public.clinic_subscription_payments to authenticated;
grant insert on public.clinic_subscription_payments to authenticated;

create or replace function public.request_clinic_subscription_payment(
  p_billing_cycle text,
  p_payment_reference text default null,
  p_owner_note text default null
)
returns public.clinic_subscription_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  sub public.clinic_subscriptions;
  existing_payment public.clinic_subscription_payments;
  saved_payment public.clinic_subscription_payments;
  normalized_cycle text;
  requested_amount numeric;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  select * into actor
  from public.profiles
  where id = auth.uid()
    and active = true;

  if actor.id is null or actor.clinic_id is null then
    raise exception 'Active clinic profile not found';
  end if;

  if actor.role not in ('owner', 'head_doctor') then
    raise exception 'Only clinic owner can request subscription payment review';
  end if;

  normalized_cycle := lower(trim(coalesce(p_billing_cycle, 'monthly')));

  if normalized_cycle not in ('monthly', 'yearly') then
    raise exception 'Invalid billing cycle';
  end if;

  requested_amount := case when normalized_cycle = 'yearly' then 9588 else 799 end;

  insert into public.clinic_subscriptions (
    clinic_id,
    plan_name,
    status,
    trial_started_at,
    trial_ends_at,
    monthly_price,
    visit_limit
  )
  values (
    actor.clinic_id,
    'trial',
    'trial',
    now(),
    now() + interval '3 months',
    799,
    null
  )
  on conflict (clinic_id) do nothing;

  select * into sub
  from public.clinic_subscriptions
  where clinic_id = actor.clinic_id
  limit 1;

  select * into existing_payment
  from public.clinic_subscription_payments
  where clinic_id = actor.clinic_id
    and status = 'pending_review'
  order by requested_at desc
  limit 1;

  if existing_payment.id is not null then
    update public.clinic_subscription_payments
    set
      subscription_id = sub.id,
      requested_by = actor.id,
      billing_cycle = normalized_cycle,
      amount = requested_amount,
      payment_method = 'manual',
      payment_reference = nullif(trim(coalesce(p_payment_reference, '')), ''),
      owner_note = nullif(trim(coalesce(p_owner_note, '')), ''),
      requested_at = now(),
      admin_note = null,
      reviewed_at = null,
      reviewed_by = null
    where id = existing_payment.id
    returning * into saved_payment;
  else
    insert into public.clinic_subscription_payments (
      clinic_id,
      subscription_id,
      requested_by,
      billing_cycle,
      amount,
      payment_method,
      payment_reference,
      owner_note,
      status
    )
    values (
      actor.clinic_id,
      sub.id,
      actor.id,
      normalized_cycle,
      requested_amount,
      'manual',
      nullif(trim(coalesce(p_payment_reference, '')), ''),
      nullif(trim(coalesce(p_owner_note, '')), ''),
      'pending_review'
    )
    returning * into saved_payment;
  end if;

  return saved_payment;
end;
$$;

grant execute on function public.request_clinic_subscription_payment(text, text, text) to authenticated;

create or replace function public.admin_approve_clinic_subscription_payment(
  p_payment_id uuid,
  p_admin_note text default null
)
returns public.clinic_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.clinic_subscription_payments;
  sub public.clinic_subscriptions;
  months_to_add integer;
  period_base timestamptz;
begin
  select * into payment
  from public.clinic_subscription_payments
  where id = p_payment_id
  for update;

  if payment.id is null then
    raise exception 'Payment request not found';
  end if;

  if payment.status <> 'pending_review' then
    raise exception 'Only pending payment requests can be approved';
  end if;

  months_to_add := case when payment.billing_cycle = 'yearly' then 12 else 1 end;

  select * into sub
  from public.clinic_subscriptions
  where clinic_id = payment.clinic_id
  for update;

  period_base := greatest(coalesce(sub.current_period_end, now()), now());

  insert into public.clinic_subscriptions (
    clinic_id,
    plan_name,
    status,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    monthly_price,
    visit_limit
  )
  values (
    payment.clinic_id,
    payment.billing_cycle,
    'active',
    now(),
    now(),
    now(),
    now() + make_interval(months => months_to_add),
    799,
    null
  )
  on conflict (clinic_id) do update
  set
    plan_name = excluded.plan_name,
    status = 'active',
    current_period_start = now(),
    current_period_end = period_base + make_interval(months => months_to_add),
    monthly_price = 799,
    updated_at = now()
  returning * into sub;

  update public.clinic_subscription_payments
  set
    status = 'approved',
    admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = payment.id;

  return sub;
end;
$$;

create or replace function public.admin_reject_clinic_subscription_payment(
  p_payment_id uuid,
  p_admin_note text default null
)
returns public.clinic_subscription_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.clinic_subscription_payments;
begin
  update public.clinic_subscription_payments
  set
    status = 'rejected',
    admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_payment_id
    and status = 'pending_review'
  returning * into payment;

  if payment.id is null then
    raise exception 'Pending payment request not found';
  end if;

  return payment;
end;
$$;

-- Approval/rejection is intentionally admin-only from SQL editor/service role.
revoke execute on function public.admin_approve_clinic_subscription_payment(uuid, text) from anon, authenticated;
revoke execute on function public.admin_reject_clinic_subscription_payment(uuid, text) from anon, authenticated;
