-- DMS MVP 3-level foundation
-- Roles: head_doctor > working_doctor > receptionist
-- This SQL is safe for new projects. For existing projects, run carefully after backup.

create extension if not exists "pgcrypto";

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references clinics(id) on delete cascade,
  name text not null,
  email text,
  role text not null check (role in ('head_doctor', 'working_doctor', 'receptionist', 'owner', 'doctor')),
  invite_code text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists staff_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade not null,
  email text not null,
  name text not null,
  role text not null check (role in ('working_doctor', 'receptionist')),
  invite_code text not null unique,
  invited_by uuid references profiles(id),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Optional migration from previous crude role names.
update profiles set role = 'head_doctor' where role = 'owner';
update profiles set role = 'working_doctor' where role = 'doctor';

create or replace function create_owner_clinic(
  clinic_name text,
  owner_name text,
  clinic_phone text default null,
  clinic_email text default null,
  clinic_address text default null
)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  new_clinic clinics;
  new_profile profiles;
begin
  insert into clinics(name, phone, email, address)
  values (clinic_name, clinic_phone, clinic_email, clinic_address)
  returning * into new_clinic;

  insert into profiles(id, clinic_id, name, email, role, active)
  values (auth.uid(), new_clinic.id, owner_name, clinic_email, 'head_doctor', true)
  returning * into new_profile;

  return new_profile;
end;
$$;

create or replace function create_staff_invite(
  staff_name text,
  staff_email text,
  staff_role text
)
returns staff_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  caller profiles;
  new_invite staff_invites;
  code text;
begin
  select * into caller from profiles where id = auth.uid() and active = true;

  if caller.id is null or caller.role not in ('head_doctor', 'owner') then
    raise exception 'Only head doctor can invite staff';
  end if;

  if staff_role = 'doctor' then
    staff_role := 'working_doctor';
  end if;

  if staff_role not in ('working_doctor', 'receptionist') then
    raise exception 'Invalid staff role';
  end if;

  code := 'DMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into staff_invites(clinic_id, email, name, role, invite_code, invited_by)
  values (caller.clinic_id, lower(staff_email), staff_name, staff_role, code, caller.id)
  returning * into new_invite;

  return new_invite;
end;
$$;

create or replace function accept_staff_invite_by_code(code text)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  invite staff_invites;
  new_profile profiles;
  user_email text;
begin
  select email into user_email from auth.users where id = auth.uid();

  select * into invite
  from staff_invites
  where upper(invite_code) = upper(code)
    and accepted_at is null
  limit 1;

  if invite.id is null then
    raise exception 'Invalid or already used invite code';
  end if;

  insert into profiles(id, clinic_id, name, email, role, active)
  values (auth.uid(), invite.clinic_id, invite.name, user_email, invite.role, true)
  on conflict (id) do update
    set clinic_id = excluded.clinic_id,
        name = excluded.name,
        email = excluded.email,
        role = excluded.role,
        active = true
  returning * into new_profile;

  update staff_invites set accepted_at = now() where id = invite.id;

  return new_profile;
end;
$$;

alter table clinics enable row level security;
alter table profiles enable row level security;
alter table staff_invites enable row level security;

drop policy if exists "profiles read own clinic" on profiles;
create policy "profiles read own clinic"
on profiles for select
using (
  id = auth.uid()
  or clinic_id in (select clinic_id from profiles where id = auth.uid() and active = true)
);

drop policy if exists "clinics read own clinic" on clinics;
create policy "clinics read own clinic"
on clinics for select
using (
  id in (select clinic_id from profiles where id = auth.uid() and active = true)
);

drop policy if exists "staff invites read own clinic" on staff_invites;
create policy "staff invites read own clinic"
on staff_invites for select
using (
  clinic_id in (select clinic_id from profiles where id = auth.uid() and active = true)
);

-- Storage buckets recommended:
-- prescriptions
-- xrays
-- patient-files
