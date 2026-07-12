-- Fix staff invite codes and role names for existing MiDMS Supabase projects.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('owner', 'head_doctor', 'doctor', 'working_doctor', 'receptionist'));

alter table public.staff_invites
add column if not exists invite_code text;

alter table public.staff_invites
alter column email drop not null;

alter table public.staff_invites
drop constraint if exists staff_invites_role_check;

alter table public.staff_invites
add constraint staff_invites_role_check
check (role in ('doctor', 'working_doctor', 'receptionist'));

create unique index if not exists staff_invites_invite_code_idx
on public.staff_invites(invite_code)
where invite_code is not null;

update public.staff_invites
set invite_code = 'DMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where invite_code is null;

drop function if exists public.create_staff_invite(text, text, text);

create or replace function public.create_staff_invite(
  invitee_name text,
  invitee_email text default null,
  invitee_role text default 'working_doctor'
)
returns public.staff_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_profile public.profiles;
  saved_invite public.staff_invites;
  normalized_role text;
  clean_email text;
  new_invite_code text;
begin
  select *
  into owner_profile
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1;

  if owner_profile.id is null then
    raise exception 'Profile not found for current user';
  end if;

  if owner_profile.role not in ('owner', 'head_doctor') then
    raise exception 'Only the clinic owner can invite staff';
  end if;

  normalized_role := case
    when invitee_role = 'doctor' then 'working_doctor'
    else invitee_role
  end;

  if normalized_role not in ('working_doctor', 'receptionist') then
    raise exception 'Staff role must be working_doctor or receptionist';
  end if;

  clean_email := nullif(lower(trim(coalesce(invitee_email, ''))), '');

  if clean_email is not null and exists (
    select 1
    from public.profiles
    where clinic_id = owner_profile.clinic_id
      and lower(email) = clean_email
  ) then
    raise exception 'This staff email already belongs to your clinic';
  end if;

  loop
    new_invite_code := 'DMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1 from public.staff_invites where invite_code = new_invite_code
    );
  end loop;

  if clean_email is not null then
    insert into public.staff_invites (
      clinic_id,
      email,
      name,
      role,
      invited_by,
      accepted_at,
      invite_code
    )
    values (
      owner_profile.clinic_id,
      clean_email,
      trim(invitee_name),
      normalized_role,
      owner_profile.id,
      null,
      new_invite_code
    )
    on conflict (clinic_id, email) do update
    set
      name = excluded.name,
      role = excluded.role,
      invited_by = excluded.invited_by,
      accepted_at = null,
      invite_code = excluded.invite_code,
      created_at = now()
    returning * into saved_invite;
  else
    insert into public.staff_invites (
      clinic_id,
      email,
      name,
      role,
      invited_by,
      accepted_at,
      invite_code
    )
    values (
      owner_profile.clinic_id,
      null,
      trim(invitee_name),
      normalized_role,
      owner_profile.id,
      null,
      new_invite_code
    )
    returning * into saved_invite;
  end if;

  return saved_invite;
end;
$$;

create or replace function public.accept_staff_invite_by_code(
  code text
)
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
  where upper(invite_code) = upper(trim(code))
    and accepted_at is null
  order by created_at desc
  limit 1;

  if invite.id is null then
    raise exception 'No pending invite found for this code';
  end if;

  if invite.email is not null and lower(invite.email) <> lower(coalesce(user_email, '')) then
    raise exception 'This invite code is assigned to a different email';
  end if;

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), invite.clinic_id, invite.name, coalesce(user_email, invite.email), invite.role, true)
  returning * into new_profile;

  update public.staff_invites
  set accepted_at = now()
  where id = invite.id;

  return new_profile;
end;
$$;

grant execute on function public.create_staff_invite(text, text, text) to authenticated;
grant execute on function public.accept_staff_invite_by_code(text) to authenticated;
