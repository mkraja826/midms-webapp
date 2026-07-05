-- DMS v1.1 revenue category fix
-- Shows all collected amounts in dashboard revenue and keeps pending collections
-- categorized as OP, X-ray, medication, treatment, or other when tied to an invoice.

alter table public.invoices
add column if not exists payment_category text not null default 'treatment_fee',
add column if not exists invoice_type text,
add column if not exists notes text;

alter table public.payments
add column if not exists payment_category text not null default 'pending_collection',
add column if not exists collected_by uuid references public.profiles(id);

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

drop function if exists public.record_patient_payment(uuid, uuid, numeric, text, text, text);

create or replace function public.record_patient_payment(
  p_patient_id uuid,
  p_invoice_id uuid default null,
  p_amount numeric default 0,
  p_payment_method text default 'Cash',
  p_payment_category text default 'pending_collection',
  p_notes text default null
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

grant execute on function public.get_workflow_dashboard_summary() to authenticated;
grant execute on function public.record_patient_payment(uuid, uuid, numeric, text, text, text) to authenticated;
