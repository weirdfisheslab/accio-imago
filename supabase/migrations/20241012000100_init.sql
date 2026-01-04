create table if not exists public.products (
  id text primary key,
  name text not null,
  stripe_price_id text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id uuid references auth.users(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  stripe_subscription_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.usage (
  user_id uuid references auth.users(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  free_exports_used int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.products add column if not exists name text;
alter table public.products add column if not exists stripe_price_id text;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists created_at timestamptz default now();

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists created_at timestamptz default now();

alter table public.entitlements add column if not exists plan text;
alter table public.entitlements add column if not exists status text;
alter table public.entitlements add column if not exists current_period_end timestamptz;
alter table public.entitlements add column if not exists stripe_subscription_id text;
alter table public.entitlements add column if not exists updated_at timestamptz default now();

alter table public.usage add column if not exists free_exports_used int default 0;
alter table public.usage add column if not exists updated_at timestamptz default now();

create unique index if not exists profiles_stripe_customer_id_key on public.profiles (stripe_customer_id);
create index if not exists entitlements_stripe_subscription_id_idx on public.entitlements (stripe_subscription_id);
create index if not exists entitlements_product_id_idx on public.entitlements (product_id);
create index if not exists usage_product_id_idx on public.usage (product_id);

alter table public.products enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage enable row level security;

create policy "Products are readable by authenticated users"
  on public.products
  for select
  to authenticated
  using (true);

create policy "Entitlements are readable by owner"
  on public.entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Usage is readable by owner"
  on public.usage
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Usage is updatable by owner"
  on public.usage
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.consume_free_export(p_user_id uuid, p_product_id text)
returns table (allowed boolean, reason text, free_exports_used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_period_end timestamptz;
  v_used int;
begin
  select status, current_period_end
    into v_status, v_period_end
  from public.entitlements
  where user_id = p_user_id
    and product_id = p_product_id;

  if v_status = 'active' and v_period_end is not null and v_period_end > now() then
    return query select true, 'pro_active', null::int;
    return;
  end if;

  insert into public.usage (user_id, product_id, free_exports_used, updated_at)
  values (p_user_id, p_product_id, 1, now())
  on conflict (user_id, product_id) do update
    set free_exports_used = public.usage.free_exports_used + 1,
        updated_at = now()
    where public.usage.free_exports_used < 1
  returning public.usage.free_exports_used
    into v_used;

  if v_used is null then
    select free_exports_used
      into v_used
    from public.usage
    where user_id = p_user_id
      and product_id = p_product_id;

    return query select false, 'free_limit_reached', v_used;
    return;
  end if;

  return query select true, 'free_export_consumed', v_used;
end;
$$;
