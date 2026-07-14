-- MiDMS no-trial subscription plans.
-- Run after the existing clinic subscription and Google Play billing migrations.
--
-- Play Console products expected:
--   Professional:        midms_monthly_799
--   Clinic Intelligence: midms_clinic_intelligence_monthly

begin;

alter table public.clinic_subscriptions
  alter column plan_name set default 'free',
  alter column status set default 'free',
  alter column monthly_price set default 0;

alter table public.clinic_subscriptions
  alter column trial_started_at drop not null,
  alter column trial_ends_at drop not null;

alter table public.clinic_subscriptions
  alter column billing_provider set default 'manual';

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_status_check;

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_status_check
  check (status in ('free', 'trial', 'active', 'expired', 'cancelled', 'grace_period'));

alter table public.clinic_subscriptions
  drop constraint if exists clinic_subscriptions_google_play_status_check;

alter table public.clinic_subscriptions
  add constraint clinic_subscriptions_google_play_status_check
  check (google_play_status in ('not_started', 'trial_started', 'active', 'grace_period', 'account_hold', 'expired', 'cancelled', 'pending_verification'));

update public.clinic_subscriptions
set
  plan_name = 'professional',
  status = 'active',
  monthly_price = 799,
  billing_provider = 'google_play',
  google_play_status = 'active',
  google_play_auto_renewing = true,
  current_period_start = coalesce(current_period_start, google_play_linked_at, now()),
  current_period_end = coalesce(current_period_end, now() + interval '1 month')
where google_play_purchase_token is not null
  and google_play_product_id = 'midms_monthly_799';

update public.clinic_subscriptions
set
  plan_name = 'clinic_intelligence',
  status = 'active',
  monthly_price = 1500,
  billing_provider = 'google_play',
  google_play_status = 'active',
  google_play_auto_renewing = true,
  current_period_start = coalesce(current_period_start, google_play_linked_at, now()),
  current_period_end = coalesce(current_period_end, now() + interval '1 month')
where google_play_purchase_token is not null
  and google_play_product_id = 'midms_clinic_intelligence_monthly';

update public.clinic_subscriptions
set
  plan_name = 'free',
  status = 'free',
  trial_started_at = null,
  trial_ends_at = null,
  current_period_start = null,
  current_period_end = null,
  monthly_price = 0,
  visit_limit = null,
  billing_provider = 'manual',
  google_play_product_id = null,
  google_play_purchase_token = null,
  google_play_order_id = null,
  google_play_auto_renewing = false,
  google_play_status = 'not_started',
  google_play_linked_at = null,
  google_play_last_event_at = null,
  google_play_last_verified_at = null
where google_play_purchase_token is null
  and (plan_name in ('trial', 'google_play_monthly') or status = 'trial');

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
    current_period_start,
    current_period_end,
    monthly_price,
    visit_limit,
    billing_provider,
    google_play_status,
    google_play_auto_renewing
  )
  values (
    new_clinic_id,
    'free',
    'free',
    null,
    null,
    null,
    null,
    0,
    null,
    'manual',
    'not_started',
    false
  )
  on conflict (clinic_id) do nothing;

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), new_clinic_id, owner_name, user_email, 'owner', true)
  returning * into new_profile;

  return new_profile;
end;
$$;

grant execute on function public.create_owner_clinic(text, text, text, text, text) to authenticated;

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
  normalized_product_id text := trim(coalesce(p_product_id, ''));
  normalized_order_id text := nullif(trim(coalesce(p_order_id, '')), '');
  resolved_plan_name text;
  resolved_monthly_price numeric;
  paid_period_end timestamptz := now() + interval '1 month';
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if normalized_product_id = '' then
    raise exception 'Google Play product id is required';
  end if;

  if nullif(trim(coalesce(p_purchase_token, '')), '') is null then
    raise exception 'Google Play purchase token is required';
  end if;

  if normalized_product_id = 'midms_monthly_799' then
    resolved_plan_name := 'professional';
    resolved_monthly_price := 799;
  elsif normalized_product_id = 'midms_clinic_intelligence_monthly' then
    resolved_plan_name := 'clinic_intelligence';
    resolved_monthly_price := 1500;
  else
    raise exception 'Unsupported MiDMS Google Play product: %', normalized_product_id;
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
    visit_limit,
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
    resolved_plan_name,
    'active',
    null,
    null,
    now(),
    paid_period_end,
    resolved_monthly_price,
    null,
    'google_play',
    normalized_product_id,
    trim(p_purchase_token),
    normalized_order_id,
    coalesce(p_auto_renewing, true),
    'active',
    now(),
    now()
  )
  on conflict (clinic_id) do update
  set
    plan_name = resolved_plan_name,
    status = 'active',
    trial_started_at = null,
    trial_ends_at = null,
    current_period_start = now(),
    current_period_end = paid_period_end,
    monthly_price = resolved_monthly_price,
    visit_limit = null,
    billing_provider = 'google_play',
    google_play_product_id = normalized_product_id,
    google_play_purchase_token = trim(p_purchase_token),
    google_play_order_id = normalized_order_id,
    google_play_auto_renewing = coalesce(p_auto_renewing, true),
    google_play_status = 'active',
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
    normalized_product_id,
    trim(p_purchase_token),
    normalized_order_id,
    coalesce(p_auto_renewing, true),
    coalesce(p_raw_purchase, '{}'::jsonb)
  );

  return updated_subscription;
end;
$$;

grant execute on function public.record_google_play_subscription_purchase(text, text, text, boolean, jsonb) to authenticated;

commit;
