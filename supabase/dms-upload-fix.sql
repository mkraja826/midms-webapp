-- DMS upload safety patch.
-- Run this once in Supabase SQL Editor if photo/file uploads fail.

alter table public.files
add column if not exists file_note text,
add column if not exists xray_amount numeric not null default 0,
add column if not exists xray_fee_status text not null default 'not_applicable';

alter table public.files
alter column xray_amount set default 0;

update public.files
set xray_amount = 0
where xray_amount is null;

alter table public.files
alter column xray_amount set not null;

alter table public.files
alter column xray_fee_status set default 'not_applicable';

update public.files
set xray_fee_status = 'not_applicable'
where xray_fee_status is null;

alter table public.files
alter column xray_fee_status set not null;

alter table public.files
drop constraint if exists files_file_type_check;

alter table public.files
add constraint files_file_type_check
check (file_type in ('before_photo', 'after_photo', 'xray', 'prescription', 'report', 'other'));

alter table public.files
drop constraint if exists files_xray_fee_status_check;

alter table public.files
add constraint files_xray_fee_status_check
check (xray_fee_status in ('not_applicable', 'pending', 'paid', 'waived'));

insert into storage.buckets (id, name, public)
values
  ('prescriptions', 'prescriptions', true),
  ('xrays', 'xrays', true),
  ('patient-files', 'patient-files', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "clinic members read storage files" on storage.objects;
create policy "clinic members read storage files"
on storage.objects for select
using (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
);

drop policy if exists "clinic members upload clinical files" on storage.objects;
create policy "clinic members upload clinical files"
on storage.objects for insert
with check (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
);

drop policy if exists "clinic members update clinical files" on storage.objects;
create policy "clinic members update clinical files"
on storage.objects for update
using (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
)
with check (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
);

drop policy if exists "clinic members delete clinical files" on storage.objects;
create policy "clinic members delete clinical files"
on storage.objects for delete
using (
  bucket_id in ('prescriptions', 'xrays', 'patient-files')
  and (storage.foldername(name))[1] = public.current_clinic_id()::text
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
);

drop policy if exists "clinic members read files" on public.files;
create policy "clinic members read files"
on public.files for select
using (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members insert files" on public.files;
create policy "clinic members insert files"
on public.files for insert
with check (
  clinic_id = public.current_clinic_id()
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
);

drop policy if exists "clinic members update files" on public.files;
create policy "clinic members update files"
on public.files for update
using (
  clinic_id = public.current_clinic_id()
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
)
with check (
  clinic_id = public.current_clinic_id()
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
);

drop policy if exists "clinic members delete files" on public.files;
create policy "clinic members delete files"
on public.files for delete
using (
  clinic_id = public.current_clinic_id()
  and public.current_role() in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist')
);

drop function if exists public.delete_patient_file(uuid);

create or replace function public.delete_patient_file(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles;
  target_file public.files;
begin
  select * into caller
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1;

  if caller.id is null or caller.clinic_id is null then
    raise exception 'Clinic profile not found';
  end if;

  if caller.role not in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist') then
    raise exception 'You do not have permission to delete files';
  end if;

  select * into target_file
  from public.files
  where id = p_file_id
    and clinic_id = caller.clinic_id
  limit 1;

  if target_file.id is null then
    return false;
  end if;

  delete from public.files
  where id = p_file_id
    and clinic_id = caller.clinic_id;

  return true;
end;
$$;

grant execute on function public.delete_patient_file(uuid) to authenticated;
