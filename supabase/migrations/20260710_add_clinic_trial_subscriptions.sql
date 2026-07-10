-- MiDMS clinic subscription model
-- Run this once in Supabase SQL editor before testing the trial/subscription flow.

create table if not exists public.clinic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  plan_name text not null default 'trial',
  status text not null default 'trial' check (status in ('trial', 'active', 'expired', 'cancelled', 'grace_period')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '3 months'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_price numeric not null default 799,
  visit_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_subscriptions_clinic_idx
on public.clinic_subscriptions(clinic_id);

create or replace function public.touch_clinic_subscription_updated_at()
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

drop trigger if exists clinic_subscriptions_touch_updated_at on public.clinic_subscriptions;
create trigger clinic_subscriptions_touch_updated_at
before update on public.clinic_subscriptions
for each row execute function public.touch_clinic_subscription_updated_at();

alter table public.clinic_subscriptions enable row level security;

drop policy if exists "clinic members read subscription" on public.clinic_subscriptions;
create policy "clinic members read subscription" on public.clinic_subscriptions
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners manage subscription" on public.clinic_subscriptions;
create policy "owners manage subscription" on public.clinic_subscriptions
for all using (clinic_id = public.current_clinic_id() and public.current_role() = 'owner')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

create or replace function public.create_owner_clinic(
  clinic_name text,
  owner_name text,
  clinic_phone text default null,
  clinic_email text default null,
  clinic_address text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  new_clinic_id uuid;
  new_profile public.profiles;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This user already belongs to a clinic';
  end if;

  user_email := coalesce(auth.jwt() ->> 'email', clinic_email);

  insert into public.clinics (name, phone, email, address)
  values (clinic_name, clinic_phone, coalesce(clinic_email, user_email), clinic_address)
  returning id into new_clinic_id;

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
    new_clinic_id,
    'trial',
    'trial',
    now(),
    now() + interval '3 months',
    799,
    null
  )
  on conflict (clinic_id) do nothing;

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), new_clinic_id, owner_name, user_email, 'owner', true)
  returning * into new_profile;

  return new_profile;
end;
$$;

grant execute on function public.create_owner_clinic(text, text, text, text, text) to authenticated;
