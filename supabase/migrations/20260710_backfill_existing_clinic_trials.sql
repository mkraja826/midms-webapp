-- Backfill trial subscription rows for clinics that existed before the subscription feature.
-- Run after 20260710_add_clinic_trial_subscriptions.sql.

insert into public.clinic_subscriptions (
  clinic_id,
  plan_name,
  status,
  trial_started_at,
  trial_ends_at,
  monthly_price,
  visit_limit
)
select
  c.id,
  'trial',
  'trial',
  now(),
  now() + interval '3 months',
  799,
  null
from public.clinics c
where not exists (
  select 1
  from public.clinic_subscriptions s
  where s.clinic_id = c.id
);
