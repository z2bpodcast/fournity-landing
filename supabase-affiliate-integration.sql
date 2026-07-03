-- ============================================================
-- FOURNITY — Wire into existing Z2B affiliate system
-- Run this AFTER supabase-schema.sql, in the same Supabase
-- project as your Z2B Marketplace (referral_clicks,
-- marketplace_commissions, profiles already exist there).
-- ============================================================

-- 1. Add referral tracking to leads and orders
alter table public.fournity_leads
  add column if not exists referral_code text;

alter table public.fournity_orders
  add column if not exists referral_code text;

create index if not exists fournity_leads_referral_idx
  on public.fournity_leads (referral_code);
create index if not exists fournity_orders_referral_idx
  on public.fournity_orders (referral_code);

-- ============================================================
-- 2. Log a referral click safely from the public landing page
-- The anon key cannot read `profiles` directly (RLS), so this
-- function runs with elevated rights just to resolve the code
-- and record the click. It never exposes profile data back.
-- ============================================================
create or replace function public.log_fournity_referral_click(
  p_referral_code text,
  p_referrer_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  if p_referral_code is null or p_referral_code = '' then
    return;
  end if;

  select id into v_referrer_id
  from profiles
  where referral_code = p_referral_code
  limit 1;

  insert into referral_clicks (referrer_id, referral_code, product, referrer_url)
  values (v_referrer_id, p_referral_code, 'fournity-book', p_referrer_url);
end;
$$;

-- Allow the public landing page (anon key) to call this function
grant execute on function public.log_fournity_referral_click(text, text) to anon;

-- ============================================================
-- 3. When an order is marked "paid", automatically create a
-- commission row in marketplace_commissions — same 20% system
-- your other Z2B affiliates already use.
-- ============================================================
create or replace function public.fournity_order_paid_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_sale_amount integer;
  v_commission_pct integer := 20;
begin
  -- Only fire the moment payment_status changes TO 'paid'
  if new.payment_status = 'paid' and (old.payment_status is distinct from 'paid') then
    if new.referral_code is not null and new.referral_code <> '' then
      select id into v_referrer_id
      from profiles
      where referral_code = new.referral_code
      limit 1;

      if v_referrer_id is not null then
        v_sale_amount := round(new.amount_cents / 100.0);

        insert into marketplace_commissions (
          referrer_id, referral_code, product_slug,
          sale_amount, commission_pct, commission_amt,
          status, sale_ref
        ) values (
          v_referrer_id, new.referral_code, 'fournity-book',
          v_sale_amount, v_commission_pct,
          round(v_sale_amount * v_commission_pct / 100.0),
          'pending', new.yoco_charge_id
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fournity_order_paid_commission_trg on public.fournity_orders;
create trigger fournity_order_paid_commission_trg
  after update on public.fournity_orders
  for each row
  execute function public.fournity_order_paid_commission();

-- ============================================================
-- 4. Safe way for the public site to mark a Yoco order paid
-- Anon never gets a broad UPDATE permission — this function
-- only allows flipping a pending Yoco order to paid, nothing
-- else. The commission trigger above still fires normally
-- because a real UPDATE happens underneath.
-- ============================================================
create or replace function public.mark_fournity_order_paid(
  p_order_id uuid,
  p_charge_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update fournity_orders
  set payment_status = 'paid', yoco_charge_id = p_charge_id
  where id = p_order_id
    and payment_method = 'yoco'
    and payment_status = 'pending';
end;
$$;

grant execute on function public.mark_fournity_order_paid(uuid, text) to anon;

-- ============================================================
-- Notes:
-- - Marking an order "paid" happens from the Supabase dashboard
--   or a service-role key (e.g. a Yoco webhook), never from the
--   public site — so this trigger only ever fires on trusted
--   updates, same as your existing commission flow.
-- - referral_code is optional on both leads and orders: if
--   nobody was referred, these simply stay null and nothing
--   is logged. No referral link required for a normal sale.
-- ============================================================
