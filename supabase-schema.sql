-- ============================================================
-- FOURNITY landing page — Supabase schema
-- Run this in the Supabase SQL editor for your project.
-- ============================================================

-- LEADS: people who join the free preview gate
create table if not exists public.fournity_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  source text default 'landing_page',
  created_at timestamptz not null default now()
);

create index if not exists fournity_leads_email_idx on public.fournity_leads (email);

-- ORDERS: pre-orders, whether paid by card (Yoco) or EFT
create table if not exists public.fournity_orders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  whatsapp text not null,
  street_address text not null,
  suburb text,
  city text,
  postal_code text,
  province text,
  payment_method text not null check (payment_method in ('yoco', 'eft')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'verifying', 'paid', 'failed')),
  amount_cents integer not null default 35000,
  currency text not null default 'ZAR',
  yoco_charge_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fournity_orders_email_idx on public.fournity_orders (email);
create index if not exists fournity_orders_status_idx on public.fournity_orders (payment_status);

-- Keep updated_at current on every change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fournity_orders_set_updated_at on public.fournity_orders;
create trigger fournity_orders_set_updated_at
  before update on public.fournity_orders
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- The landing page uses the public anon key, so we allow
-- inserts from anyone (it's a public order/lead form) but
-- block reads/updates/deletes from the anon key entirely.
-- Rev and the Z2B team read/manage orders from the Supabase
-- dashboard or a service-role key, never from the browser.
-- ============================================================

alter table public.fournity_leads enable row level security;
alter table public.fournity_orders enable row level security;

drop policy if exists "Allow public insert on leads" on public.fournity_leads;
create policy "Allow public insert on leads"
  on public.fournity_leads
  for insert
  to anon
  with check (true);

drop policy if exists "Allow public insert on orders" on public.fournity_orders;
create policy "Allow public insert on orders"
  on public.fournity_orders
  for insert
  to anon
  with check (true);

-- No select/update/delete policies for anon = those are blocked by default with RLS on.
