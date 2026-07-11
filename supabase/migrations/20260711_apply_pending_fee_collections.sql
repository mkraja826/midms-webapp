-- MiDMS account fix
-- Collecting a fee should first close existing pending invoices for the same patient/category.
-- This prevents pending dues from remaining open when the receptionist collects an old balance.

drop function if exists public.collect_reception_fee(uuid, text, numeric, text, text);

create function public.collect_reception_fee(
  p_patient_id uuid,
  p_fee_type text,
  p_amount numeric,
  p_payment_method text,
  p_notes text
)
returns table(invoice_id uuid, payment_id uuid, amount numeric, fee_type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_clinic_id uuid;
  v_patient_clinic_id uuid;
  v_invoice_id uuid;
  v_payment_id uuid;
  v_amount numeric;
  v_remaining numeric;
  v_apply_amount numeric;
  v_new_paid numeric;
  v_fee_type text;
  v_payment_category text;
  v_invoice record;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select pr.clinic_id
  into v_clinic_id
  from public.profiles pr
  where pr.id = v_user_id
    and pr.active = true
  limit 1;

  if v_clinic_id is null then
    raise exception 'Clinic not found for current user';
  end if;

  select pt.clinic_id
  into v_patient_clinic_id
  from public.patients pt
  where pt.id = p_patient_id
  limit 1;

  if v_patient_clinic_id is null then
    raise exception 'Patient not found';
  end if;

  if v_patient_clinic_id <> v_clinic_id then
    raise exception 'Patient does not belong to your clinic';
  end if;

  v_fee_type := lower(trim(coalesce(p_fee_type, 'op_fee')));

  if v_fee_type = 'consultation_fee' then
    v_fee_type := 'op_fee';
  end if;

  if v_fee_type not in ('op_fee', 'medication_fee', 'xray_fee', 'treatment_fee', 'other') then
    v_fee_type := 'other';
  end if;

  v_payment_category := v_fee_type;
  v_amount := coalesce(p_amount, case when v_fee_type = 'op_fee' then 300 else 0 end);

  if v_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  v_remaining := v_amount;

  -- First apply collection to existing pending invoices in the same category.
  for v_invoice in
    select i.id,
           coalesce(i.total_amount, 0) as total_amount,
           coalesce(i.paid_amount, 0) as paid_amount,
           coalesce(i.due_amount, 0) as due_amount
    from public.invoices i
    where i.clinic_id = v_clinic_id
      and i.patient_id = p_patient_id
      and i.payment_category = v_payment_category
      and coalesce(i.due_amount, 0) > 0
      and i.status in ('unpaid', 'partial')
    order by i.created_at asc, i.id asc
  loop
    exit when v_remaining <= 0;

    v_apply_amount := least(v_remaining, v_invoice.due_amount);
    v_new_paid := least(v_invoice.total_amount, v_invoice.paid_amount + v_apply_amount);

    update public.invoices
    set paid_amount = v_new_paid,
        due_amount = greatest(v_invoice.total_amount - v_new_paid, 0),
        status = case when greatest(v_invoice.total_amount - v_new_paid, 0) <= 0 then 'paid' else 'partial' end
    where id = v_invoice.id;

    insert into public.payments (
      clinic_id,
      patient_id,
      invoice_id,
      amount,
      payment_method,
      notes,
      payment_category,
      collected_by
    )
    values (
      v_clinic_id,
      p_patient_id,
      v_invoice.id,
      v_apply_amount,
      coalesce(nullif(trim(p_payment_method), ''), 'Cash'),
      coalesce(nullif(trim(p_notes), ''), 'Pending fee collection'),
      v_payment_category,
      v_user_id
    )
    returning id into v_payment_id;

    invoice_id := v_invoice.id;
    payment_id := v_payment_id;
    amount := v_apply_amount;
    fee_type := v_fee_type;
    return next;

    v_remaining := v_remaining - v_apply_amount;
  end loop;

  -- If there is no old pending balance, or the collected amount is more than old due,
  -- create a normal paid invoice for the remaining amount.
  if v_remaining > 0 then
    insert into public.invoices (
      clinic_id,
      patient_id,
      total_amount,
      paid_amount,
      due_amount,
      status,
      invoice_type,
      payment_category,
      notes
    )
    values (
      v_clinic_id,
      p_patient_id,
      v_remaining,
      v_remaining,
      0,
      'paid',
      v_fee_type,
      v_payment_category,
      coalesce(nullif(trim(p_notes), ''), v_fee_type)
    )
    returning id into v_invoice_id;

    insert into public.payments (
      clinic_id,
      patient_id,
      invoice_id,
      amount,
      payment_method,
      notes,
      payment_category,
      collected_by
    )
    values (
      v_clinic_id,
      p_patient_id,
      v_invoice_id,
      v_remaining,
      coalesce(nullif(trim(p_payment_method), ''), 'Cash'),
      coalesce(nullif(trim(p_notes), ''), v_fee_type),
      v_payment_category,
      v_user_id
    )
    returning id into v_payment_id;

    invoice_id := v_invoice_id;
    payment_id := v_payment_id;
    amount := v_remaining;
    fee_type := v_fee_type;
    return next;
  end if;
end;
$$;

grant execute on function public.collect_reception_fee(uuid, text, numeric, text, text) to authenticated;
