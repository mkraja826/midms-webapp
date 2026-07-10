-- MiDMS Google Play Billing autopay subscription support.
-- Run this after the clinic subscription migrations.
-- Play Console setup required:
--   Subscription product id: midms_monthly_799
--   Auto-renewing monthly base plan
--   New-customer offer with 3 months free trial

alter table public.clinic_subscriptions
  add column if not exists billing_provider text not null default 'google_play';

alter table public.clinic_subscriptions
  add column if not exists google_play_product_id text,
  add column if not exists google_play_purchase_token text,
  add column if not exists google_play_order_id text,
  add column if not exists google_play_auto_renewing boolean not null default false,
  add column if not exists google_play_status text not null default 'not_started',
  add column if not exists google_play_linked_at timestamptz,
  add column if not exists google_play_last_event_at timestamptz,
  add column if not exists google_play_last_verified_at timestamptz;

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_billing_provider_check;

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_billing_provider_check
  check (billing_provider in ('google_play', 'manual'));

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_google_play_status_check;

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_google_play_status_check
  check (google_play_status in ('not_started', 'trial_started', 'active', 'grace_period', 'account_hold', 'expired', 'cancelled', 'pending_verification'));

create table if not exists public.google_play_subscription_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  subscription_id uuid references public.clinic_subscriptions(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null default 'client_purchase',
  product_id text not null,
  purchase_token text not null,
  order_id text,
  auto_renewing boolean not null default true,
  raw_purchase jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists google_play_subscription_events_clinic_idx
on public.google_play_subscription_events(clinic_id, created_at desc);

create index if not exists google_play_subscription_events_token_idx
on public.google_play_subscription_events(purchase_token);

alter table public.google_play_subscription_events enable row level security;

drop policy if exists dms_clinic_isolation_google_play_subscription_events on public.google_play_subscription_events;
create policy dms_clinic_isolation_google_play_subscription_events
on public.google_play_subscription_events
as restrictive
for all
to authenticated
using (clinic_id = public.current_profile_clinic_id())
with check (clinic_id = public.current_profile_clinic_id());

create or replace function public.record_google_play_subscription_purchase(
  p_product_id text,
  p_purchase_token text,
  p_order_id text default null,
  p_auto_renewing boolean default true,
  p_raw_purchase jsonb default '{}'::jsonb
)
returns public.clinic_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  updated_subscription public.clinic_subscriptions;
  trial_end timestamptz := now() + interval '3 months';
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if nullif(trim(p_product_id), '') is null then
    raise exception 'Google Play product id is required';
  end if;

  if nullif(trim(p_purchase_token), '') is null then
    raise exception 'Google Play purchase token is required';
  end if;

  select * into actor
  from public.profiles
  where id = auth.uid()
    and active = true;

  if actor.id is null or actor.clinic_id is null then
    raise exception 'Active clinic profile not found';
  end if;

  insert into public.clinic_subscriptions (
    clinic_id,
    plan_name,
    status,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end,
    monthly_price,
    billing_provider,
    google_play_product_id,
    google_play_purchase_token,
    google_play_order_id,
    google_play_auto_renewing,
    google_play_status,
    google_play_linked_at,
    google_play_last_event_at
  )
  values (
    actor.clinic_id,
    'google_play_monthly',
    'trial',
    now(),
    trial_end,
    now(),
    trial_end,
    799,
    'google_play',
    trim(p_product_id),
    trim(p_purchase_token),
    nullif(trim(p_order_id), ''),
    coalesce(p_auto_renewing, true),
    'trial_started',
    now(),
    now()
  )
  on conflict (clinic_id) do update
  set
    plan_name = 'google_play_monthly',
    status = case
      when public.clinic_subscriptions.status in ('active', 'grace_period')
        and public.clinic_subscriptions.current_period_end is not null
        and public.clinic_subscriptions.current_period_end > now()
      then public.clinic_subscriptions.status
      else 'trial'
    end,
    trial_started_at = case
      when public.clinic_subscriptions.trial_ends_at is null
        or public.clinic_subscriptions.trial_ends_at < now()
      then now()
      else public.clinic_subscriptions.trial_started_at
    end,
    trial_ends_at = case
      when public.clinic_subscriptions.trial_ends_at is null
        or public.clinic_subscriptions.trial_ends_at < now()
      then trial_end
      else public.clinic_subscriptions.trial_ends_at
    end,
    current_period_start = coalesce(public.clinic_subscriptions.current_period_start, now()),
    current_period_end = case
      when public.clinic_subscriptions.current_period_end is null
        or public.clinic_subscriptions.current_period_end < now()
      then trial_end
      else public.clinic_subscriptions.current_period_end
    end,
    monthly_price = 799,
    billing_provider = 'google_play',
    google_play_product_id = trim(p_product_id),
    google_play_purchase_token = trim(p_purchase_token),
    google_play_order_id = nullif(trim(p_order_id), ''),
    google_play_auto_renewing = coalesce(p_auto_renewing, true),
    google_play_status = case
      when public.clinic_subscriptions.status in ('active', 'grace_period')
        and public.clinic_subscriptions.current_period_end is not null
        and public.clinic_subscriptions.current_period_end > now()
      then 'active'
      else 'trial_started'
    end,
    google_play_linked_at = coalesce(public.clinic_subscriptions.google_play_linked_at, now()),
    google_play_last_event_at = now()
  returning * into updated_subscription;

  insert into public.google_play_subscription_events (
    clinic_id,
    subscription_id,
    profile_id,
    event_type,
    product_id,
    purchase_token,
    order_id,
    auto_renewing,
    raw_purchase
  )
  values (
    actor.clinic_id,
    updated_subscription.id,
    actor.id,
    'client_purchase',
    trim(p_product_id),
    trim(p_purchase_token),
    nullif(trim(p_order_id), ''),
    coalesce(p_auto_renewing, true),
    coalesce(p_raw_purchase, '{}'::jsonb)
  );

  return updated_subscription;
end;
$$;

grant execute on function public.record_google_play_subscription_purchase(text, text, text, boolean, jsonb) to authenticated;
