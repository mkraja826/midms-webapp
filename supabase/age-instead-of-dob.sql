-- Add simple patient age field for existing DMS projects.
-- Run once in Supabase SQL Editor.

alter table public.patients
add column if not exists age integer check (age is null or (age >= 0 and age <= 130));
