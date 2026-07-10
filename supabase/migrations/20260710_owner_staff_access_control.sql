-- Owner/head doctor staff access control.
-- Run this once in Supabase SQL editor before testing Staff role/active controls.

create or replace function public.owner_update_staff_access(
  p_staff_id uuid,
  p_staff_role text default null,
  p_staff_active boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  updated_profile public.profiles;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  select * into actor
  from public.profiles
  where id = auth.uid()
    and active = true;

  if actor.id is null or actor.clinic_id is null then
    raise exception 'Active clinic profile not found';
  end if;

  if actor.role not in ('owner', 'head_doctor') then
    raise exception 'Only clinic owner can manage staff access';
  end if;

  if p_staff_id = auth.uid() then
    raise exception 'You cannot change your own owner access';
  end if;

  if p_staff_role is not null then
    normalized_role := case
      when p_staff_role = 'doctor' then 'working_doctor'
      else p_staff_role
    end;

    if normalized_role not in ('working_doctor', 'receptionist') then
      raise exception 'Invalid staff role';
    end if;
  end if;

  update public.profiles
  set
    role = coalesce(normalized_role, role),
    active = coalesce(p_staff_active, active)
  where id = p_staff_id
    and clinic_id = actor.clinic_id
    and role not in ('owner', 'head_doctor')
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Staff member not found or owner access cannot be changed';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.owner_update_staff_access(uuid, text, boolean) to authenticated;
