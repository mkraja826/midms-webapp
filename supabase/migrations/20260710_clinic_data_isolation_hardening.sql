-- Clinic data isolation hardening for MiDMS.
-- Run this after the feature migrations in Supabase SQL Editor.
-- Goal: even if an app screen forgets a clinic_id filter, Supabase RLS restricts data to the logged-in user's active clinic.

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

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1
$$;

grant execute on function public.current_profile_role() to authenticated;

create or replace function public.apply_dms_clinic_isolation_policy(
  p_table_name text,
  p_clinic_column text default 'clinic_id'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_name text := 'dms_clinic_isolation_' || p_table_name;
begin
  if to_regclass('public.' || p_table_name) is null then
    return;
  end if;

  execute format('alter table public.%I enable row level security', p_table_name);

  execute format(
    'drop policy if exists %I on public.%I',
    policy_name,
    p_table_name
  );

  execute format(
    'create policy %I on public.%I as restrictive for all to authenticated using (%I = public.current_profile_clinic_id()) with check (%I = public.current_profile_clinic_id())',
    policy_name,
    p_table_name,
    p_clinic_column,
    p_clinic_column
  );
end;
$$;

-- Tables with a direct clinic_id column.
select public.apply_dms_clinic_isolation_policy('patients');
select public.apply_dms_clinic_isolation_policy('profiles');
select public.apply_dms_clinic_isolation_policy('staff_invites');
select public.apply_dms_clinic_isolation_policy('appointments');
select public.apply_dms_clinic_isolation_policy('patient_visits');
select public.apply_dms_clinic_isolation_policy('treatments');
select public.apply_dms_clinic_isolation_policy('invoices');
select public.apply_dms_clinic_isolation_policy('payments');
select public.apply_dms_clinic_isolation_policy('files');
select public.apply_dms_clinic_isolation_policy('charges');
select public.apply_dms_clinic_isolation_policy('patient_audit_logs');
select public.apply_dms_clinic_isolation_policy('patient_medications');
select public.apply_dms_clinic_isolation_policy('clinic_subscriptions');

-- medical_history is linked through patient_id, so isolate through the patient's clinic.
do $$
begin
  if to_regclass('public.medical_history') is not null then
    alter table public.medical_history enable row level security;
    drop policy if exists dms_clinic_isolation_medical_history on public.medical_history;

    create policy dms_clinic_isolation_medical_history
    on public.medical_history
    as restrictive
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.patients p
        where p.id = medical_history.patient_id
          and p.clinic_id = public.current_profile_clinic_id()
      )
    )
    with check (
      exists (
        select 1
        from public.patients p
        where p.id = medical_history.patient_id
          and p.clinic_id = public.current_profile_clinic_id()
      )
    );
  end if;
end $$;

-- Storage path isolation for clinical files.
-- Existing app uploads clinical files under: <clinic_id>/<patient_id>/<file>.
-- This restrictive policy prevents one clinic from reading/writing another clinic's folder,
-- while leaving non-clinical buckets untouched.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists dms_storage_clinic_path_isolation on storage.objects;

    create policy dms_storage_clinic_path_isolation
    on storage.objects
    as restrictive
    for all
    to authenticated
    using (
      bucket_id not in ('prescriptions', 'xrays', 'patient-files')
      or (storage.foldername(name))[1] = public.current_profile_clinic_id()::text
    )
    with check (
      bucket_id not in ('prescriptions', 'xrays', 'patient-files')
      or (storage.foldername(name))[1] = public.current_profile_clinic_id()::text
    );
  end if;
end $$;

-- Keep helper private from anonymous users.
revoke execute on function public.apply_dms_clinic_isolation_policy(text, text) from anon;
grant execute on function public.apply_dms_clinic_isolation_policy(text, text) to authenticated;
