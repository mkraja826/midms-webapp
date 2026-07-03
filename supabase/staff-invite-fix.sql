-- Fix staff invite creation for existing DMS Supabase projects.
-- Run this once in Supabase SQL Editor.

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
  select *
  into owner_profile
  from public.profiles
  where id = auth.uid()
    and active = true
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
    select 1
    from public.profiles
    where clinic_id = owner_profile.clinic_id
      and lower(email) = lower(staff_email)
  ) then
    raise exception 'This staff email already belongs to your clinic';
  end if;

  insert into public.staff_invites (
    clinic_id,
    email,
    name,
    role,
    invited_by,
    accepted_at
  )
  values (
    owner_profile.clinic_id,
    lower(staff_email),
    staff_name,
    staff_role,
    owner_profile.id,
    null
  )
  on conflict (clinic_id, email) do update
  set
    name = excluded.name,
    role = excluded.role,
    invited_by = excluded.invited_by,
    accepted_at = null,
    created_at = now()
  returning * into saved_invite;

  return saved_invite;
end;
$$;

grant execute on function public.create_staff_invite(text, text, text) to authenticated;
