-- Ontwikkelomgeving: pgTAP + Supabase CLI, supabase test db.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000101','ordinary@example.invalid'),
 ('00000000-0000-0000-0000-000000000102','admin@example.invalid');
insert into public.admins(user_id) values('00000000-0000-0000-0000-000000000102');
insert into public.products(id,name,category,kind,published) values
 ('00000000-0000-0000-0000-000000000201','Published test','verzorging','product',true),
 ('00000000-0000-0000-0000-000000000202','Draft test','verzorging','product',false);
insert into public.posts(title,body,kind,published) values('Published post','test','blog',true),('Draft post','test','blog',false);
set local role anon;
select is(public.is_admin(),false,'Anonymous visitors are not admins');
select is((select count(*)::integer from public.products where id in ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000202')),1,'Anonymous visitors see published products only');
select throws_ok('select * from public.inventory','42501',null,'Anonymous visitors cannot read inventory');
select throws_ok('select * from public.stock_movements','42501',null,'Anonymous visitors cannot read stock history');
select throws_ok($$insert into public.products(name,category,kind) values('Denied','verzorging','product')$$,'42501',null,'Anonymous visitors cannot create products');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
select is(public.is_admin(),false,'Regular signed-in users are not admins');
select is((select count(*)::integer from public.inventory),0,'Regular signed-in users see no inventory');
select throws_ok($$insert into public.posts(title,body,kind) values('Denied','Denied','blog')$$,'42501',null,'Regular signed-in users cannot create posts');
select throws_ok($$select public.adjust_stock('00000000-0000-0000-0000-000000000201',1,'Denied')$$,'42501',null,'Regular signed-in users cannot adjust stock');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select is(public.is_admin(),true,'Allowed users are admins');
select is((select count(*)::integer from public.products where id in ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000202')),2,'Admins can read drafts');
select lives_ok($$select public.adjust_stock('00000000-0000-0000-0000-000000000201',5,'Test delivery')$$,'Admins can receive stock');
select is((select quantity from public.inventory where product_id='00000000-0000-0000-0000-000000000201'),5,'Stock adjustment was stored');
select throws_ok($$select public.adjust_stock('00000000-0000-0000-0000-000000000201',-6,'Too much')$$,'P0001','Ongeldige nieuwe voorraad','Negative stock is rejected');
select * from finish();
rollback;
