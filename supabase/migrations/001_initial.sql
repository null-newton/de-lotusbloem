-- Nefertem: uitvoeren in de Supabase SQL Editor (eenmalig).
begin;
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160),
  description text not null default '', category text not null check(category in ('schoonheid','thuisverpleging','verzorging')),
  kind text not null check(kind in ('product','dienst')), price numeric(10,2) check(price >= 0),
  duration integer check(duration between 1 and 1440), image_url text not null default '', published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.posts (
  id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 180),
  excerpt text not null default '', body text not null, kind text not null check(kind in ('blog','aankondiging')),
  image_url text not null default '', published boolean not null default false, created_at timestamptz not null default now()
);
create table public.practice_settings (
  id integer primary key check(id=1), email text not null default '', phone text not null default '', address text not null default '',
  region text not null default '', about text not null default '', logo_url text not null default ''
);
insert into public.practice_settings(id,address,region,about) values(1,'Stationsdreef 215, 8800 Roeselare, België','Roeselare','Ik ben Veronique Wostyn, het gezicht achter Nefertem. Hier komen schoonheidsverzorging en thuisverpleging samen. Met een persoonlijke benadering, een rustig gesprek en tijd voor wat jij nodig hebt.');
create table public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  quantity integer not null default 0 check(quantity>=0), minimum integer not null default 3 check(minimum>=0), sku text not null default ''
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null check(delta<>0), note text not null default '', actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
alter table public.posts enable row level security;
alter table public.practice_settings enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.products, public.posts, public.practice_settings, public.inventory, public.stock_movements from anon, authenticated;
grant select on public.products, public.posts, public.practice_settings to anon, authenticated;
grant insert, update, delete on public.products, public.posts to authenticated;
grant update on public.practice_settings to authenticated;
grant select on public.inventory to authenticated;
grant update(minimum,sku) on public.inventory to authenticated;
grant select on public.stock_movements to authenticated;
create policy "published products" on public.products for select to anon,authenticated using(published or (select public.is_admin()));
create policy "admin products" on public.products for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "published posts" on public.posts for select to anon,authenticated using(published or (select public.is_admin()));
create policy "admin posts" on public.posts for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "public practice details" on public.practice_settings for select to anon,authenticated using(true);
create policy "admin practice details" on public.practice_settings for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "admin inventory" on public.inventory for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "admin stock history" on public.stock_movements for select to authenticated using((select public.is_admin()));
-- Elke productrij heeft een voorraadrij. Diensten krijgen nooit voorraad.
create function public.sync_product_inventory() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind='product' then insert into public.inventory(product_id) values(new.id) on conflict do nothing;
  else delete from public.inventory where product_id=new.id; end if;
  return new;
end;
$$;
revoke all on function public.sync_product_inventory() from public;
create trigger product_inventory after insert or update of kind on public.products for each row execute function public.sync_product_inventory();
-- Atomaire voorraadwijziging en logboek: geen verloren updates of negatieve voorraad.
create function public.adjust_stock(target_product uuid, change integer, reason text) returns void language plpgsql security definer set search_path='' as $$
declare current_quantity integer;
begin
  if not public.is_admin() then raise exception 'Geen beheerrechten' using errcode='42501'; end if;
  if change is null or change=0 then raise exception 'Ongeldige voorraadwijziging'; end if;
  if reason is null or length(trim(reason))=0 or length(reason)>300 then raise exception 'Vul een reden in (maximaal 300 tekens)'; end if;
  perform 1 from public.products where id=target_product and kind='product' for update;
  if not found then raise exception 'Product niet gevonden'; end if;
  insert into public.inventory(product_id) values(target_product) on conflict do nothing;
  select quantity into current_quantity from public.inventory where product_id=target_product for update;
  if current_quantity::bigint + change < 0 or current_quantity::bigint + change > 2147483647 then raise exception 'Ongeldige nieuwe voorraad'; end if;
  update public.inventory set quantity=quantity+change where product_id=target_product;
  insert into public.stock_movements(product_id,delta,note,actor_id) values(target_product,change,trim(reason),auth.uid());
end;
$$;
revoke all on function public.adjust_stock(uuid,integer,text) from public;
grant execute on function public.adjust_stock(uuid,integer,text) to authenticated;
create index posts_published_created on public.posts(published,created_at desc);
create index products_published_created on public.products(published,created_at desc);
create index stock_movements_product_created on public.stock_movements(product_id,created_at desc);
commit;
