-- Add before/after patient photo support.
-- Run this once in Supabase SQL Editor for existing projects.

alter table public.files
drop constraint if exists files_file_type_check;

alter table public.files
add constraint files_file_type_check
check (file_type in ('prescription', 'xray', 'before_photo', 'after_photo', 'report', 'other'));
