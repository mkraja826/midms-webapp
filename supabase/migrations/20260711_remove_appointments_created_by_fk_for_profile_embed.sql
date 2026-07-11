-- PostgREST could not embed appointments -> profiles because appointments had
-- both doctor_id and created_by foreign keys pointing to profiles.
-- Dashboard only needs the doctor relationship when embedding profiles.
-- Keep created_by as a staff-tracking UUID column, but remove its FK constraint
-- so existing dashboard queries remain unambiguous.

alter table public.appointments
  drop constraint if exists appointments_created_by_fkey;

notify pgrst, 'reload schema';
