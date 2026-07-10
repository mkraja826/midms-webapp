alter table public.clinics
  add column if not exists enable_patient_photos boolean not null default false;

alter table public.clinics
  add column if not exists enable_prescription_medications boolean not null default false;

alter table public.patients
  add column if not exists photo_url text;

create index if not exists patients_photo_url_idx
on public.patients(photo_url)
where photo_url is not null;

create table if not exists public.medication_catalog (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  usage_count integer not null default 1,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, normalized_name)
);

create table if not exists public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_name text not null,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  prescribed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists medication_catalog_clinic_usage_idx
on public.medication_catalog(clinic_id, usage_count desc, last_used_at desc);

create index if not exists patient_medications_patient_created_idx
on public.patient_medications(patient_id, created_at desc);

create index if not exists patient_medications_clinic_created_idx
on public.patient_medications(clinic_id, created_at desc);

alter table public.medication_catalog enable row level security;
alter table public.patient_medications enable row level security;

drop policy if exists "clinic members read medication catalog" on public.medication_catalog;
create policy "clinic members read medication catalog"
on public.medication_catalog
for select
to authenticated
using (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members manage medication catalog" on public.medication_catalog;
create policy "clinic members manage medication catalog"
on public.medication_catalog
for all
to authenticated
using (clinic_id = public.current_clinic_id())
with check (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members read patient medications" on public.patient_medications;
create policy "clinic members read patient medications"
on public.patient_medications
for select
to authenticated
using (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members insert patient medications" on public.patient_medications;
create policy "clinic members insert patient medications"
on public.patient_medications
for insert
to authenticated
with check (clinic_id = public.current_clinic_id());

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can read patient files" on storage.objects;
create policy "Authenticated users can read patient files"
on storage.objects
for select
to authenticated
using (bucket_id = 'patient-files');

drop policy if exists "Authenticated users can upload patient files" on storage.objects;
create policy "Authenticated users can upload patient files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'patient-files');

drop policy if exists "Authenticated users can update patient files" on storage.objects;
create policy "Authenticated users can update patient files"
on storage.objects
for update
to authenticated
using (bucket_id = 'patient-files')
with check (bucket_id = 'patient-files');

grant select, insert, update on public.medication_catalog to authenticated;
grant select, insert on public.patient_medications to authenticated;
