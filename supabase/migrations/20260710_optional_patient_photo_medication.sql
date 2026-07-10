alter table public.clinics
  add column if not exists enable_patient_photos boolean not null default false;

alter table public.clinics
  add column if not exists enable_medication_module boolean not null default false;

alter table public.patients
  add column if not exists photo_url text;

create index if not exists patients_photo_url_idx
on public.patients(photo_url)
where photo_url is not null;

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
