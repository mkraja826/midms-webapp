-- MiDMS clinic OP fee setting
-- Each clinic can set its own default OP/consultation fee from owner Account Settings.

alter table public.clinics
  add column if not exists op_fee_amount numeric(10,2) not null default 300;

update public.clinics
set op_fee_amount = 300
where op_fee_amount is null or op_fee_amount <= 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinics_op_fee_amount_positive'
      and conrelid = 'public.clinics'::regclass
  ) then
    alter table public.clinics
      add constraint clinics_op_fee_amount_positive check (op_fee_amount > 0);
  end if;
end $$;
