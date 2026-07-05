-- DMS v1.1 clinic-ready patch.
-- Run this once in the Supabase SQL editor after taking a backup.
-- This file is additive and keeps existing patient, invoice, payment, and file data.

alter table public.invoices
add column if not exists payment_category text not null default 'treatment_fee',
add column if not exists invoice_type text,
add column if not exists notes text;

alter table public.invoices
drop constraint if exists invoices_payment_category_check;

alter table public.invoices
add constraint invoices_payment_category_check
check (payment_category in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other'));

alter table public.payments
add column if not exists payment_category text not null default 'pending_collection',
add column if not exists collected_by uuid references public.profiles(id) on delete set null;

alter table public.payments
drop constraint if exists payments_payment_category_check;

alter table public.payments
add constraint payments_payment_category_check
check (payment_category in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other'));

update public.invoices
set payment_category = case
  when invoice_type in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other') then invoice_type
  when invoice_type in ('consultation_fee', 'op', 'opd', 'opd_fee') then 'op_fee'
  when invoice_type in ('xray', 'x_ray', 'radiology') then 'xray_fee'
  when invoice_type in ('medicine', 'medicine_fee', 'medication') then 'medication_fee'
  when invoice_type in ('treatment', 'procedure', 'procedure_fee') then 'treatment_fee'
  when coalesce(notes, '') ilike '%op fee%' or coalesce(notes, '') ilike '%reception op%' then 'op_fee'
  when coalesce(notes, '') ilike '%x-ray%' or coalesce(notes, '') ilike '%xray%' then 'xray_fee'
  when coalesce(notes, '') ilike '%medication%' or coalesce(notes, '') ilike '%medicine%' then 'medication_fee'
  when coalesce(notes, '') ilike '%treatment%' or coalesce(notes, '') ilike '%procedure%' then 'treatment_fee'
  when coalesce(notes, '') ilike '%other%' then 'other'
  else payment_category
end
where payment_category in ('treatment_fee', 'pending_collection')
   or invoice_type is not null;

update public.payments p
set payment_category = i.payment_category
from public.invoices i
where p.invoice_id = i.id
  and p.payment_category in ('pending_collection', 'treatment_fee')
  and i.payment_category in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other');

update public.payments
set payment_category = case
  when coalesce(notes, '') ilike '%op fee%' or coalesce(notes, '') ilike '%reception op%' then 'op_fee'
  when coalesce(notes, '') ilike '%x-ray%' or coalesce(notes, '') ilike '%xray%' then 'xray_fee'
  when coalesce(notes, '') ilike '%medication%' or coalesce(notes, '') ilike '%medicine%' then 'medication_fee'
  when coalesce(notes, '') ilike '%treatment%' then 'treatment_fee'
  when coalesce(notes, '') ilike '%other%' then 'other'
  else payment_category
end
where payment_category = 'pending_collection';

alter table public.files
add column if not exists file_note text,
add column if not exists xray_amount numeric not null default 0,
add column if not exists xray_fee_status text not null default 'not_applicable';

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

alter table public.appointments
add column if not exists reminder_status text not null default 'pending',
add column if not exists reminder_sent_at timestamptz,
add column if not exists reminder_status_at timestamptz,
add column if not exists op_fee_amount numeric not null default 0,
add column if not exists op_fee_status text not null default 'pending',
add column if not exists op_fee_waiver_reason text,
add column if not exists op_fee_waived_by uuid references public.profiles(id) on delete set null,
add column if not exists op_fee_waived_at timestamptz;

alter table public.appointments
drop constraint if exists appointments_reminder_status_check;

alter table public.appointments
add constraint appointments_reminder_status_check
check (reminder_status in ('pending', 'message_sent', 'patient_confirmed', 'not_reachable', 'completed'));

alter table public.appointments
drop constraint if exists appointments_op_fee_status_check;

alter table public.appointments
add constraint appointments_op_fee_status_check
check (op_fee_status in ('paid', 'pending', 'waived'));

create table if not exists public.patient_audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists patient_audit_logs_patient_idx on public.patient_audit_logs(patient_id, created_at desc);
create index if not exists invoices_category_created_idx on public.invoices(clinic_id, payment_category, created_at);
create index if not exists payments_category_created_idx on public.payments(clinic_id, payment_category, created_at);
create index if not exists appointments_reminder_idx on public.appointments(clinic_id, reminder_status, appointment_time);

alter table public.patient_audit_logs enable row level security;

drop policy if exists "clinic members read patient audit logs" on public.patient_audit_logs;
create policy "clinic members read patient audit logs"
on public.patient_audit_logs for select
using (clinic_id = public.current_clinic_id());

drop policy if exists "clinic members insert patient audit logs" on public.patient_audit_logs;
create policy "clinic members insert patient audit logs"
on public.patient_audit_logs for insert
with check (clinic_id = public.current_clinic_id());

create or replace function public.invoice_status(total numeric, paid numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(paid, 0) <= 0 then 'unpaid'
    when coalesce(paid, 0) >= coalesce(total, 0) then 'paid'
    else 'partial'
  end
$$;

drop function if exists public.collect_reception_fee(uuid, text, numeric, text, text);

create or replace function public.collect_reception_fee(
  p_patient_id uuid,
  p_fee_type text,
  p_amount numeric,
  p_payment_method text default 'Cash',
  p_notes text default null
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles;
  saved_invoice public.invoices;
begin
  select * into caller from public.profiles where id = auth.uid() and active = true limit 1;
  if caller.id is null or caller.clinic_id is null then
    raise exception 'Clinic profile not found';
  end if;

  if p_fee_type not in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other') then
    raise exception 'Invalid payment category';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  insert into public.invoices (
    clinic_id, patient_id, total_amount, paid_amount, due_amount, status, payment_category, notes
  )
  values (
    caller.clinic_id, p_patient_id, p_amount, p_amount, 0, 'paid', p_fee_type, p_notes
  )
  returning * into saved_invoice;

  insert into public.payments (
    clinic_id, invoice_id, patient_id, amount, payment_method, notes, payment_category, collected_by
  )
  values (
    caller.clinic_id, saved_invoice.id, p_patient_id, p_amount, p_payment_method, p_notes, p_fee_type, caller.id
  );

  return saved_invoice;
end;
$$;

drop function if exists public.reception_quick_checkin(uuid, text, text, integer, text, text, numeric, text, text, text);

create or replace function public.reception_quick_checkin(
  p_patient_id uuid default null,
  p_name text default null,
  p_phone text default null,
  p_age integer default null,
  p_gender text default null,
  p_address text default null,
  p_op_amount numeric default 300,
  p_op_status text default 'paid',
  p_waiver_reason text default null,
  p_payment_method text default 'Cash'
)
returns table(patient_id uuid, appointment_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles;
  final_patient_id uuid;
  saved_appointment_id uuid;
  saved_invoice public.invoices;
  paid_amount numeric;
  due_amount numeric;
begin
  select * into caller from public.profiles where id = auth.uid() and active = true limit 1;
  if caller.id is null or caller.clinic_id is null then
    raise exception 'Clinic profile not found';
  end if;

  if p_op_status not in ('paid', 'pending', 'waived') then
    raise exception 'Invalid OP fee status';
  end if;

  if p_patient_id is null then
    if nullif(trim(coalesce(p_name, '')), '') is null then
      raise exception 'Patient name required';
    end if;

    insert into public.patients (
      clinic_id, patient_code, name, phone, age, gender, address
    )
    values (
      caller.clinic_id,
      'DMS-' || right(extract(epoch from now())::bigint::text, 6),
      trim(p_name),
      nullif(trim(coalesce(p_phone, '')), ''),
      p_age,
      nullif(trim(coalesce(p_gender, '')), ''),
      nullif(trim(coalesce(p_address, '')), '')
    )
    returning id into final_patient_id;

    insert into public.medical_history(patient_id) values (final_patient_id)
    on conflict (patient_id) do nothing;
  else
    final_patient_id := p_patient_id;
  end if;

  insert into public.appointments (
    clinic_id,
    patient_id,
    doctor_id,
    appointment_time,
    status,
    notes,
    op_fee_amount,
    op_fee_status,
    op_fee_waiver_reason,
    op_fee_waived_by,
    op_fee_waived_at
  )
  values (
    caller.clinic_id,
    final_patient_id,
    null,
    now(),
    'scheduled',
    'Reception quick check-in',
    case when p_op_status = 'waived' then 0 else coalesce(p_op_amount, 0) end,
    p_op_status,
    case when p_op_status = 'waived' then p_waiver_reason else null end,
    case when p_op_status = 'waived' then caller.id else null end,
    case when p_op_status = 'waived' then now() else null end
  )
  returning id into saved_appointment_id;

  if p_op_status in ('paid', 'pending') and coalesce(p_op_amount, 0) > 0 then
    paid_amount := case when p_op_status = 'paid' then p_op_amount else 0 end;
    due_amount := greatest(p_op_amount - paid_amount, 0);

    insert into public.invoices (
      clinic_id, patient_id, total_amount, paid_amount, due_amount, status, payment_category, notes
    )
    values (
      caller.clinic_id,
      final_patient_id,
      p_op_amount,
      paid_amount,
      due_amount,
      public.invoice_status(p_op_amount, paid_amount),
      'op_fee',
      'Reception OP fee'
    )
    returning * into saved_invoice;

    if p_op_status = 'paid' then
      insert into public.payments (
        clinic_id, invoice_id, patient_id, amount, payment_method, notes, payment_category, collected_by
      )
      values (
        caller.clinic_id, saved_invoice.id, final_patient_id, p_op_amount, p_payment_method, 'Reception OP fee', 'op_fee', caller.id
      );
    end if;
  end if;

  return query select final_patient_id, saved_appointment_id;
end;
$$;

drop function if exists public.get_workflow_dashboard_summary();

create or replace function public.get_workflow_dashboard_summary()
returns table(
  today_revenue numeric,
  pending_payments numeric,
  op_fee_revenue_today numeric,
  xray_revenue_today numeric,
  medication_revenue_today numeric,
  treatment_revenue_today numeric,
  pending_collected_today numeric,
  other_revenue_today numeric,
  today_patient_count bigint,
  waiting_count bigint,
  completed_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with bounds as (
    select date_trunc('day', now()) as start_at, date_trunc('day', now()) + interval '1 day' as end_at
  ),
  today_payments as (
    select
      p.amount,
      case
        when i.invoice_type in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other') then i.invoice_type
        when i.invoice_type in ('consultation_fee', 'op', 'opd', 'opd_fee') then 'op_fee'
        when i.invoice_type in ('xray', 'x_ray', 'radiology') then 'xray_fee'
        when i.invoice_type in ('medicine', 'medicine_fee', 'medication') then 'medication_fee'
        when i.invoice_type in ('treatment', 'procedure', 'procedure_fee') then 'treatment_fee'
        else coalesce(i.payment_category, p.payment_category, 'pending_collection')
      end as payment_category
    from public.payments p
    left join public.invoices i on i.id = p.invoice_id
    cross join bounds b
    where p.clinic_id = public.current_clinic_id()
      and p.created_at >= b.start_at
      and p.created_at < b.end_at
  ),
  paid_invoices_without_payment as (
    select
      i.paid_amount as amount,
      case
        when i.invoice_type in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other') then i.invoice_type
        when i.invoice_type in ('consultation_fee', 'op', 'opd', 'opd_fee') then 'op_fee'
        when i.invoice_type in ('xray', 'x_ray', 'radiology') then 'xray_fee'
        when i.invoice_type in ('medicine', 'medicine_fee', 'medication') then 'medication_fee'
        when i.invoice_type in ('treatment', 'procedure', 'procedure_fee') then 'treatment_fee'
        else coalesce(i.payment_category, 'treatment_fee')
      end as payment_category
    from public.invoices i, bounds b
    where i.clinic_id = public.current_clinic_id()
      and i.created_at >= b.start_at
      and i.created_at < b.end_at
      and coalesce(i.paid_amount, 0) > 0
      and not exists (
        select 1 from public.payments p where p.invoice_id = i.id
      )
  ),
  revenue_events as (
    select amount, payment_category from today_payments
    union all
    select amount, payment_category from paid_invoices_without_payment
  )
  select
    coalesce((select sum(amount) from revenue_events), 0),
    coalesce((select sum(due_amount) from public.invoices where clinic_id = public.current_clinic_id() and due_amount > 0), 0),
    coalesce((select sum(amount) from revenue_events where payment_category = 'op_fee'), 0),
    coalesce((select sum(amount) from revenue_events where payment_category = 'xray_fee'), 0),
    coalesce((select sum(amount) from revenue_events where payment_category = 'medication_fee'), 0),
    coalesce((select sum(amount) from revenue_events where payment_category = 'treatment_fee'), 0),
    coalesce((select sum(amount) from revenue_events where payment_category = 'pending_collection'), 0),
    coalesce((select sum(amount) from revenue_events where payment_category = 'other'), 0),
    coalesce((select count(*) from public.patients p, bounds b where p.clinic_id = public.current_clinic_id() and p.created_at >= b.start_at and p.created_at < b.end_at), 0),
    coalesce((select count(*) from public.appointments a, bounds b where a.clinic_id = public.current_clinic_id() and a.appointment_time >= b.start_at and a.appointment_time < b.end_at and a.status = 'scheduled'), 0),
    coalesce((select count(*) from public.appointments a, bounds b where a.clinic_id = public.current_clinic_id() and a.appointment_time >= b.start_at and a.appointment_time < b.end_at and a.status = 'completed'), 0);
$$;

drop function if exists public.get_patient_pending_invoices(uuid);

create or replace function public.get_patient_pending_invoices(p_patient_id uuid)
returns table(
  invoice_id uuid,
  invoice_type text,
  total_amount numeric,
  paid_amount numeric,
  due_amount numeric,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select i.id, i.payment_category, i.total_amount, i.paid_amount, i.due_amount, i.status, i.created_at
  from public.invoices i
  where i.clinic_id = public.current_clinic_id()
    and i.patient_id = p_patient_id
    and i.due_amount > 0
  order by i.created_at asc;
$$;

drop function if exists public.get_pending_payment_patients(text);

create or replace function public.get_pending_payment_patients(p_search text default null)
returns table(
  patient_id uuid,
  patient_name text,
  patient_phone text,
  patient_code text,
  pending_amount numeric,
  invoice_count bigint,
  last_invoice_id uuid,
  last_invoice_date timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.name,
    p.phone,
    p.patient_code,
    sum(i.due_amount) as pending_amount,
    count(i.id) as invoice_count,
    (array_agg(i.id order by i.created_at desc))[1] as last_invoice_id,
    max(i.created_at) as last_invoice_date
  from public.patients p
  join public.invoices i on i.patient_id = p.id
  where p.clinic_id = public.current_clinic_id()
    and i.due_amount > 0
    and (
      p_search is null
      or p.name ilike '%' || p_search || '%'
      or p.phone ilike '%' || p_search || '%'
      or p.patient_code ilike '%' || p_search || '%'
    )
  group by p.id, p.name, p.phone, p.patient_code
  order by pending_amount desc, max(i.created_at) desc;
$$;

drop function if exists public.record_patient_payment(uuid, uuid, numeric, text, text, text);

create or replace function public.record_patient_payment(
  p_patient_id uuid,
  p_invoice_id uuid default null,
  p_amount numeric default 0,
  p_payment_method text default 'Cash',
  p_notes text default null,
  p_payment_category text default 'pending_collection'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles;
  remaining numeric := coalesce(p_amount, 0);
  invoice_row public.invoices;
  applied numeric;
begin
  select * into caller from public.profiles where id = auth.uid() and active = true limit 1;
  if caller.id is null or caller.clinic_id is null then
    raise exception 'Clinic profile not found';
  end if;

  if remaining <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_payment_category not in ('op_fee', 'xray_fee', 'medication_fee', 'treatment_fee', 'pending_collection', 'other') then
    raise exception 'Invalid payment category';
  end if;

  for invoice_row in
    select *
    from public.invoices
    where clinic_id = caller.clinic_id
      and patient_id = p_patient_id
      and due_amount > 0
      and (p_invoice_id is null or id = p_invoice_id)
    order by created_at asc
  loop
    exit when remaining <= 0;

    applied := least(remaining, invoice_row.due_amount);

    insert into public.payments (
      clinic_id, invoice_id, patient_id, amount, payment_method, notes, payment_category, collected_by
    )
    values (
      caller.clinic_id,
      invoice_row.id,
      p_patient_id,
      applied,
      p_payment_method,
      p_notes,
      case
        when p_payment_category = 'pending_collection'
          then coalesce(invoice_row.payment_category, 'pending_collection')
        else p_payment_category
      end,
      caller.id
    );

    update public.invoices
    set paid_amount = paid_amount + applied,
        due_amount = greatest(due_amount - applied, 0),
        status = public.invoice_status(total_amount, paid_amount + applied)
    where id = invoice_row.id;

    remaining := remaining - applied;
  end loop;

  if remaining > 0 then
    raise exception 'Payment amount exceeds pending balance';
  end if;
end;
$$;

drop function if exists public.get_reminder_summary();

create or replace function public.get_reminder_summary()
returns table(
  followups_today bigint,
  followups_overdue bigint,
  followups_tomorrow bigint,
  pending_patients bigint,
  pending_amount numeric,
  waiting_count bigint,
  completed_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with today as (
    select date_trunc('day', now()) as start_at, date_trunc('day', now()) + interval '1 day' as end_at
  )
  select
    coalesce((select count(*) from public.appointments a, today t where a.clinic_id = public.current_clinic_id() and a.appointment_time >= t.start_at and a.appointment_time < t.end_at and a.status = 'scheduled'), 0),
    coalesce((select count(*) from public.appointments a, today t where a.clinic_id = public.current_clinic_id() and a.appointment_time < t.start_at and a.status = 'scheduled'), 0),
    coalesce((select count(*) from public.appointments a, today t where a.clinic_id = public.current_clinic_id() and a.appointment_time >= t.end_at and a.appointment_time < t.end_at + interval '1 day' and a.status = 'scheduled'), 0),
    coalesce((select count(distinct patient_id) from public.invoices where clinic_id = public.current_clinic_id() and due_amount > 0), 0),
    coalesce((select sum(due_amount) from public.invoices where clinic_id = public.current_clinic_id() and due_amount > 0), 0),
    coalesce((select count(*) from public.appointments a, today t where a.clinic_id = public.current_clinic_id() and a.appointment_time >= t.start_at and a.appointment_time < t.end_at and a.status = 'scheduled'), 0),
    coalesce((select count(*) from public.appointments a, today t where a.clinic_id = public.current_clinic_id() and a.appointment_time >= t.start_at and a.appointment_time < t.end_at and a.status = 'completed'), 0);
$$;

drop function if exists public.get_followup_reminders(text, text);

create or replace function public.get_followup_reminders(
  p_filter text default 'today',
  p_search text default null
)
returns table(
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  patient_code text,
  appointment_time timestamptz,
  status text,
  notes text,
  reminder_state text,
  reminder_status text
)
language sql
security definer
set search_path = public
stable
as $$
  with bounds as (
    select date_trunc('day', now()) as start_at, date_trunc('day', now()) + interval '1 day' as end_at
  )
  select
    a.id,
    p.id,
    p.name,
    p.phone,
    p.patient_code,
    a.appointment_time,
    a.status,
    a.notes,
    case
      when a.appointment_time < b.start_at then 'overdue'
      when a.appointment_time >= b.start_at and a.appointment_time < b.end_at then 'today'
      when a.appointment_time >= b.end_at and a.appointment_time < b.end_at + interval '1 day' then 'tomorrow'
      else 'upcoming'
    end,
    a.reminder_status
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  cross join bounds b
  where a.clinic_id = public.current_clinic_id()
    and a.status = 'scheduled'
    and (
      p_filter = 'upcoming'
      or (p_filter = 'overdue' and a.appointment_time < b.start_at)
      or (p_filter = 'today' and a.appointment_time >= b.start_at and a.appointment_time < b.end_at)
      or (p_filter = 'tomorrow' and a.appointment_time >= b.end_at and a.appointment_time < b.end_at + interval '1 day')
    )
    and (
      p_search is null
      or p.name ilike '%' || p_search || '%'
      or p.phone ilike '%' || p_search || '%'
      or p.patient_code ilike '%' || p_search || '%'
    )
  order by a.appointment_time asc;
$$;

drop function if exists public.update_followup_status(uuid, text);

create or replace function public.update_followup_status(
  p_appointment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('message_sent', 'patient_confirmed', 'not_reachable', 'completed') then
    raise exception 'Invalid reminder status';
  end if;

  update public.appointments
  set reminder_status = p_status,
      reminder_sent_at = case when p_status = 'message_sent' then now() else reminder_sent_at end,
      reminder_status_at = now(),
      status = case when p_status = 'completed' then 'completed' else status end
  where id = p_appointment_id
    and clinic_id = public.current_clinic_id();
end;
$$;

grant execute on function public.collect_reception_fee(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.reception_quick_checkin(uuid, text, text, integer, text, text, numeric, text, text, text) to authenticated;
grant execute on function public.get_workflow_dashboard_summary() to authenticated;
grant execute on function public.get_patient_pending_invoices(uuid) to authenticated;
grant execute on function public.get_pending_payment_patients(text) to authenticated;
grant execute on function public.record_patient_payment(uuid, uuid, numeric, text, text, text) to authenticated;
grant execute on function public.get_reminder_summary() to authenticated;
grant execute on function public.get_followup_reminders(text, text) to authenticated;
grant execute on function public.update_followup_status(uuid, text) to authenticated;
