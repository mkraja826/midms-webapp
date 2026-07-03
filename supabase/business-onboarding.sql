-- Add SaaS-style onboarding and staff invites to an existing DMS Supabase project.
-- Run this once in the Supabase SQL editor.

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('doctor', 'receptionist')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (clinic_id, email)
);

create index if not exists staff_invites_clinic_idx on public.staff_invites(clinic_id);
create index if not exists staff_invites_email_idx on public.staff_invites(lower(email));

create or replace function public.create_owner_clinic(
  clinic_name text,
  owner_name text,
  clinic_phone text default null,
  clinic_email text default null,
  clinic_address text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  new_clinic_id uuid;
  new_profile public.profiles;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This user already belongs to a clinic';
  end if;

  user_email := coalesce(auth.jwt() ->> 'email', clinic_email);

  insert into public.clinics (name, phone, email, address)
  values (clinic_name, clinic_phone, coalesce(clinic_email, user_email), clinic_address)
  returning id into new_clinic_id;

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), new_clinic_id, owner_name, user_email, 'owner', true)
  returning * into new_profile;

  return new_profile;
end;
$$;

create or replace function public.accept_staff_invite()
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
  where lower(email) = lower(user_email)
    and accepted_at is null
  order by created_at desc
  limit 1;

  if invite.id is null then
    raise exception 'No pending invite found for %', user_email;
  end if;

  insert into public.profiles (id, clinic_id, name, email, role, active)
  values (auth.uid(), invite.clinic_id, invite.name, user_email, invite.role, true)
  returning * into new_profile;

  update public.staff_invites
  set accepted_at = now()
  where id = invite.id;

  return new_profile;
end;
$$;

grant execute on function public.create_owner_clinic(text, text, text, text, text) to authenticated;
grant execute on function public.accept_staff_invite() to authenticated;

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
  select * into owner_profile
  from public.profiles
  where id = auth.uid() and active = true
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
    select 1 from public.profiles
    where clinic_id = owner_profile.clinic_id
      and lower(email) = lower(staff_email)
  ) then
    raise exception 'This staff email already belongs to your clinic';
  end if;

  insert into public.staff_invites (clinic_id, email, name, role, invited_by, accepted_at)
  values (owner_profile.clinic_id, lower(staff_email), staff_name, staff_role, owner_profile.id, null)
  on conflict (clinic_id, email) do update
  set name = excluded.name,
      role = excluded.role,
      invited_by = excluded.invited_by,
      accepted_at = null,
      created_at = now()
  returning * into saved_invite;

  return saved_invite;
end;
$$;

grant execute on function public.create_staff_invite(text, text, text) to authenticated;

alter table public.staff_invites enable row level security;

drop policy if exists "owners read staff invites" on public.staff_invites;
create policy "owners read staff invites" on public.staff_invites
for select using (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "owners create staff invites" on public.staff_invites;
create policy "owners create staff invites" on public.staff_invites
for insert with check (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');

drop policy if exists "owners update staff invites" on public.staff_invites;
create policy "owners update staff invites" on public.staff_invites
for update using (clinic_id = public.current_clinic_id() and public.current_role() = 'owner')
with check (clinic_id = public.current_clinic_id() and public.current_role() = 'owner');
