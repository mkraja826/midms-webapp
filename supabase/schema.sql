-- DMS Supabase schema, RLS, storage setup, and seed data.
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('owner', 'doctor', 'receptionist')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('doctor', 'receptionist')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (clinic_id, email)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_code text,
  name text not null,
  gender text,
  age integer check (age is null or (age >= 0 and age <= 130)),
  dob date,
  phone text,
  email text,
  address text,
  emergency_contact text,
  created_at timestamptz not null default now()
);

create table if not exists public.medical_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  heart_issue boolean not null default false,
  kidney_issue boolean not null default false,
  brain_issue boolean not null default false,
  diabetes boolean not null default false,
  blood_pressure boolean not null default false,
  allergies text,
  current_medicines text,
  other_notes text,
  created_at timestamptz not null default now(),
  unique (patient_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null,
  appointment_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null,
  visit_date timestamptz not null default now(),
  chief_complaint text,
  diagnosis text,
  doctor_notes text,
  next_appointment_date timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid references public.patient_visits(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_name text not null,
  description text,
  cost numeric not null default 0,
  status text not null default 'planned' check (status in ('planned', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.patient_visits(id) on delete set null,
  file_type text not null check (file_type in ('prescription', 'xray', 'before_photo', 'after_photo', 'report', 'other')),
  file_url text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.patient_visits(id) on delete set null,
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  due_amount numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  amount numeric not null,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists patients_clinic_idx on public.patients(clinic_id);
create index if not exists staff_invites_clinic_idx on public.staff_invites(clinic_id);
create index if not exists staff_invites_email_idx on public.staff_invites(lower(email));
create index if not exists patients_search_idx on public.patients using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(phone, '')));
create index if not exists appointments_clinic_time_idx on public.appointments(clinic_id, appointment_time);
create index if not exists invoices_clinic_due_idx on public.invoices(clinic_id, due_amount);

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid() and active = true limit 1
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select clinic_id from public.profiles where id = auth.uid() and active = true limit 1
$$;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and active = true limit 1
$$;

create or replace function public.can_manage(resource text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when public.current_role() = 'owner' then true
    when public.current_role() = 'doctor' and resource in ('appointments', 'visits', 'treatments', 'files') then true
    when public.current_role() = 'receptionist' and resource in ('patients', 'appointments', 'invoices', 'payments') then true
    else false
  end
$$;

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

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), new_clinic_id, owner_name, user_email, 'owner', true)
  returning * into new_profile;

  return new_profile;
end;
$$;

create or replace function public.accept_staff_invite()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.staff_invites;
  new_profile public.profiles;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This user already belongs to a clinic';
  end if;

  user_email := auth.jwt() ->> 'email';

  select *
  into invite
  from public.staff_invites
  where lower(email) = lower(user_email)
    and accepted_at is null
  order by created_at desc
  limit 1;

  if invite.id is null then
    raise exception 'No pending invite found for %', user_email;
  end if;

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), invite.clinic_id, invite.name, user_email, invite.role, true)
  returning * into new_profile;

  update public.staff_invites
  set accepted_at = now()
  where id = invite.id;

  return new_profile;
end;
$$;

grant execute on function public.create_owner_clinic(text, text, text, text, text) to authenticated;
grant execute on function public.accept_staff_invite() to authenticated;

create or replace function public.create_staff_invite(
  staff_name text,
  staff_email text,
  staff_role text
)
returns public.staff_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_profile public.profiles;
  saved_invite public.staff_invites;
begin
  select * into owner_profile
  from public.profiles
  where id = auth.uid() and active = true
  limit 1;

  if owner_profile.id is null then
    raise exception 'Profile not found for current user';
  end if;

  if owner_profile.role <> 'owner' then
    raise exception 'Only the clinic owner can invite staff';
  end if;

  if staff_role not in ('doctor', 'receptionist') then
    raise exception 'Staff role must be doctor or receptionist';
  end if;

  if exists (
    select 1 from public.profiles
    where clinic_id = owner_profile.clinic_id
      and lower(email) = lower(staff_email)
  ) then
    raise exception 'This staff email already belongs to your clinic';
  end if;

  insert into public.staff_invites (clinic_id, email, name, role, invited_by, accepted_at)
  values (owner_profile.clinic_id, lower(staff_email), staff_name, staff_role, owner_profile.id, null)
  on conflict (clinic_id, email) do update
  set name = excluded.name,
      role = excluded.role,
      invited_by = excluded.invited_by,
      accepted_at = null,
      created_at = now()
  returning * into saved_invite;

  return saved_invite;
end;
$$;

grant execute on function public.create_staff_invite(text, text, text) to authenticated;

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.patients enable row level security;
alter table public.medical_history enable row level security;
alter table public.appointments enable row level security;
alter table public.patient_visits enable row level security;
alter table public.treatments enable row level security;
alter table public.files enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

drop policy if exists "clinic members read clinic" on public.clinics;
create policy "clinic members read clinic" on public.clinics
for select using (id = public.current_clinic_id());

drop policy if exists "owners update clinic" on public.clinics;
create policy "owners update clinic" on public.clinics
for update using (id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "clinic members read profiles" on public.profiles;
create policy "clinic members read profiles" on public.profiles
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners manage profiles" on public.profiles;
create policy "owners manage profiles" on public.profiles
for all using (clinic_id = public.current_clinic_id() and public.current_role() = 'owner')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid() and clinic_id = public.current_clinic_id());

drop policy if exists "owners read staff invites" on public.staff_invites;
create policy "owners read staff invites" on public.staff_invites
for select using (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "owners create staff invites" on public.staff_invites;
create policy "owners create staff invites" on public.staff_invites
for insert with check (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "owners update staff invites" on public.staff_invites;
create policy "owners update staff invites" on public.staff_invites
for update using (clinic_id = public.current_clinic_id() and public.current_role() = 'owner')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "clinic members read patients" on public.patients;
create policy "clinic members read patients" on public.patients
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners and receptionists manage patients" on public.patients;
create policy "owners and receptionists manage patients" on public.patients
for all using (clinic_id = public.current_clinic_id() and public.can_manage('patients'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('patients'));

drop policy if exists "clinic members read medical history" on public.medical_history;
create policy "clinic members read medical history" on public.medical_history
for select using (exists (
  select 1 from public.patients p where p.id = patient_id and p.clinic_id = public.current_clinic_id()
));

drop policy if exists "owners receptionists manage medical history" on public.medical_history;
create policy "owners receptionists manage medical history" on public.medical_history
for all using (exists (
  select 1 from public.patients p where p.id = patient_id and p.clinic_id = public.current_clinic_id()
) and public.current_role() in ('owner', 'receptionist'))
with check (exists (
  select 1 from public.patients p where p.id = patient_id and p.clinic_id = public.current_clinic_id()
) and public.current_role() in ('owner', 'receptionist'));

drop policy if exists "clinic members read appointments" on public.appointments;
create policy "clinic members read appointments" on public.appointments
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "clinic users manage appointments" on public.appointments;
create policy "clinic users manage appointments" on public.appointments
for all using (clinic_id = public.current_clinic_id() and public.can_manage('appointments'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('appointments'));

drop policy if exists "clinic members read visits" on public.patient_visits;
create policy "clinic members read visits" on public.patient_visits
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners doctors manage visits" on public.patient_visits;
create policy "owners doctors manage visits" on public.patient_visits
for all using (clinic_id = public.current_clinic_id() and public.can_manage('visits'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('visits'));

drop policy if exists "clinic members read treatments" on public.treatments;
create policy "clinic members read treatments" on public.treatments
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners doctors manage treatments" on public.treatments;
create policy "owners doctors manage treatments" on public.treatments
for all using (clinic_id = public.current_clinic_id() and public.can_manage('treatments'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('treatments'));

drop policy if exists "clinic members read files" on public.files;
create policy "clinic members read files" on public.files
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners doctors manage files" on public.files;
create policy "owners doctors manage files" on public.files
for all using (clinic_id = public.current_clinic_id() and public.can_manage('files'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('files'));

drop policy if exists "clinic members read invoices" on public.invoices;
create policy "clinic members read invoices" on public.invoices
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners receptionists manage invoices" on public.invoices;
create policy "owners receptionists manage invoices" on public.invoices
for all using (clinic_id = public.current_clinic_id() and public.can_manage('invoices'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('invoices'));

drop policy if exists "clinic members read payments" on public.payments;
create policy "clinic members read payments" on public.payments
for select using (clinic_id = public.current_clinic_id());

drop policy if exists "owners receptionists manage payments" on public.payments;
create policy "owners receptionists manage payments" on public.payments
for all using (clinic_id = public.current_clinic_id() and public.can_manage('payments'))
with check (clinic_id = public.current_clinic_id() and public.can_manage('payments'));

insert into storage.buckets (id, name, public)
values
  ('prescriptions', 'prescriptions', true),
  ('xrays', 'xrays', true),
  ('patient-files', 'patient-files', true)
on conflict (id) do nothing;

drop policy if exists "clinic members read storage files" on storage.objects;
create policy "clinic members read storage files" on storage.objects
for select using (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
);

drop policy if exists "owners doctors upload clinical files" on storage.objects;
create policy "owners doctors upload clinical files" on storage.objects
for insert with check (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.current_role() in ('owner', 'doctor')
);

drop policy if exists "owners doctors update clinical files" on storage.objects;
create policy "owners doctors update clinical files" on storage.objects
for update using (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.current_role() in ('owner', 'doctor')
);

-- Seed clinic and sample patients. Create the auth users first, then replace the IDs below with their auth.users IDs.
insert into public.clinics (id, name, phone, email, address)
values ('00000000-0000-0000-0000-000000000001', 'Demo Dental Clinic', '+91 98765 43210', 'clinic@example.com', 'Main Road, Demo City')
on conflict (id) do nothing;

-- Replace these IDs with real Supabase Auth user IDs before running this block.
-- insert into public.profiles (id, clinic_id, name, email, role) values
--   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Dr. Asha Owner', 'owner@example.com', 'owner'),
--   ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Dr. Neel Dentist', 'doctor@example.com', 'doctor'),
--   ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Riya Reception', 'reception@example.com', 'receptionist')
-- on conflict (id) do nothing;

insert into public.patients (id, clinic_id, patient_code, name, gender, age, dob, phone, email, address, emergency_contact)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'DMS-000001', 'Arjun Mehta', 'Male', 34, null, '+91 90000 00001', 'arjun@example.com', 'Sector 10', '+91 90000 00002'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'DMS-000002', 'Priya Shah', 'Female', 38, null, '+91 90000 00003', null, 'Market Street', '+91 90000 00004')
on conflict (id) do nothing;

insert into public.medical_history (patient_id, diabetes, blood_pressure, allergies, current_medicines, other_notes)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, false, 'No known allergies', 'None', 'Routine dental scaling history'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, true, 'Penicillin', 'Metformin, BP medication', 'Needs BP check before procedure')
on conflict (patient_id) do nothing;
