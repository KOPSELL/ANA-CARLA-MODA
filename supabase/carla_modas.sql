-- CARLA MODAS — executar no SQL Editor do projeto Supabase usado no Sex Shop.
-- Objetos isolados: prefixo carla_; nao altera tabelas existentes do Sex Shop.
-- Login via Supabase Auth. NUNCA criar politica que permita auto-cadastro como admin.

create extension if not exists pgcrypto;

create or replace function public.carla_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.carla_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor')),
  created_at timestamptz not null default now()
);

create or replace function public.carla_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.carla_admin_users a
    where a.user_id = (select auth.uid())
  )
$$;

create or replace function public.carla_is_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.carla_admin_users a
    where a.user_id = (select auth.uid()) and a.role = 'owner'
  )
$$;

create table if not exists public.carla_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 80),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text not null default '',
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carla_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.carla_categories(id) on delete restrict,
  sku text unique,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  description text not null default '',
  price numeric(12,2) check (price is null or (price >= 0 and price <= 1000000)),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  image_url text,
  gallery text[] not null default '{}',
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  stock integer check (stock is null or stock >= 0),
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carla_products_category_id_idx on public.carla_products(category_id);
create index if not exists carla_products_public_idx on public.carla_products(active, sort_order);
create index if not exists carla_categories_public_idx on public.carla_categories(active, sort_order);

create table if not exists public.carla_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'Carla Modas',
  tagline text not null default 'Veste você',
  whatsapp text not null default '5554984290397',
  instagram text not null default '',
  announcement text not null default 'Delicadeza em cada detalhe',
  hero_title text not null default 'O charme de ser você.',
  hero_subtitle text not null default 'Para todos os seus momentos, peças que abraçam sua essência.',
  hero_image_url text,
  logo_url text,
  about_text text not null default 'Conforto, delicadeza e beleza em cada escolha.',
  address text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.carla_settings (id) values (1)
on conflict (id) do nothing;

drop trigger if exists carla_categories_touch on public.carla_categories;
create trigger carla_categories_touch before update on public.carla_categories
for each row execute function public.carla_touch_updated_at();
drop trigger if exists carla_products_touch on public.carla_products;
create trigger carla_products_touch before update on public.carla_products
for each row execute function public.carla_touch_updated_at();
drop trigger if exists carla_settings_touch on public.carla_settings;
create trigger carla_settings_touch before update on public.carla_settings
for each row execute function public.carla_touch_updated_at();

alter table public.carla_admin_users enable row level security;
alter table public.carla_categories enable row level security;
alter table public.carla_products enable row level security;
alter table public.carla_settings enable row level security;

drop policy if exists carla_admin_read_self on public.carla_admin_users;
create policy carla_admin_read_self on public.carla_admin_users
for select to authenticated using (user_id = (select auth.uid()) or (select public.carla_is_owner()));

drop policy if exists carla_admin_owner_insert on public.carla_admin_users;
create policy carla_admin_owner_insert on public.carla_admin_users
for insert to authenticated with check ((select public.carla_is_owner()));

drop policy if exists carla_admin_owner_update on public.carla_admin_users;
create policy carla_admin_owner_update on public.carla_admin_users
for update to authenticated using ((select public.carla_is_owner()))
with check ((select public.carla_is_owner()));

drop policy if exists carla_admin_owner_delete on public.carla_admin_users;
create policy carla_admin_owner_delete on public.carla_admin_users
for delete to authenticated using ((select public.carla_is_owner()) and user_id <> (select auth.uid()));

drop policy if exists carla_categories_public_read on public.carla_categories;
create policy carla_categories_public_read on public.carla_categories
for select to anon, authenticated
using (active = true or (select public.carla_is_admin()));

drop policy if exists carla_categories_admin_insert on public.carla_categories;
create policy carla_categories_admin_insert on public.carla_categories
for insert to authenticated with check ((select public.carla_is_admin()));

drop policy if exists carla_categories_admin_update on public.carla_categories;
create policy carla_categories_admin_update on public.carla_categories
for update to authenticated using ((select public.carla_is_admin()))
with check ((select public.carla_is_admin()));

drop policy if exists carla_categories_admin_delete on public.carla_categories;
create policy carla_categories_admin_delete on public.carla_categories
for delete to authenticated using ((select public.carla_is_admin()));

drop policy if exists carla_products_public_read on public.carla_products;
create policy carla_products_public_read on public.carla_products
for select to anon, authenticated
using (
  ((active = true) and exists (
    select 1 from public.carla_categories c
    where c.id = category_id and c.active = true
  ))
  or (select public.carla_is_admin())
);

drop policy if exists carla_products_admin_insert on public.carla_products;
create policy carla_products_admin_insert on public.carla_products
for insert to authenticated with check ((select public.carla_is_admin()));

drop policy if exists carla_products_admin_update on public.carla_products;
create policy carla_products_admin_update on public.carla_products
for update to authenticated using ((select public.carla_is_admin()))
with check ((select public.carla_is_admin()));

drop policy if exists carla_products_admin_delete on public.carla_products;
create policy carla_products_admin_delete on public.carla_products
for delete to authenticated using ((select public.carla_is_admin()));

drop policy if exists carla_settings_public_read on public.carla_settings;
create policy carla_settings_public_read on public.carla_settings
for select to anon, authenticated using (true);

drop policy if exists carla_settings_admin_update on public.carla_settings;
create policy carla_settings_admin_update on public.carla_settings
for update to authenticated using ((select public.carla_is_admin()))
with check ((select public.carla_is_admin()));

-- Bucket publico so para imagens de catalogo, com upload restrito a administradores.
-- O projeto compartilha infraestrutura com Sex Shop, MAS os arquivos da Carla
-- ficam apenas no bucket carla-modas e as policies exigem autorizacao da Carla.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('carla-modas','carla-modas',true,8388608,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists carla_storage_public_read on storage.objects;
create policy carla_storage_public_read on storage.objects
for select to anon, authenticated using (bucket_id = 'carla-modas');

drop policy if exists carla_storage_admin_insert on storage.objects;
create policy carla_storage_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'carla-modas' and (select public.carla_is_admin()));

drop policy if exists carla_storage_admin_update on storage.objects;
create policy carla_storage_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'carla-modas' and (select public.carla_is_admin()))
with check (bucket_id = 'carla-modas' and (select public.carla_is_admin()));

drop policy if exists carla_storage_admin_delete on storage.objects;
create policy carla_storage_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'carla-modas' and (select public.carla_is_admin()));

-- Categorias iniciais: idempotentes.
insert into public.carla_categories (slug,name,description,sort_order)
values
('fitness','Moda Fitness','Conforto e estilo para se movimentar',10),
('pijamas','Pijamas','Noites aconchegantes',20),
('baby-doll','Baby Doll Rendado','Romance e delicadeza',30),
('camisolas','Camisolas','Leveza para descansar',40),
('sutias','Sutiã Comfort','Conforto todos os dias',50),
('calcinhas','Calcinhas Avulsas','Essenciais femininos',60),
('perfumes','Perfumes','Fragrâncias para todos os momentos',70)
on conflict (slug) do nothing;

-- Produtos informados por print: os textos truncados foram abreviados;
-- sem foto real nem dados de tamanho confirmados. Nao inventamos estoque ou precos.
with catalog(sku,cat,name,description,price,sort_order) as (
  values
  ('CARLA-FIT-001','fitness','Moda Fitness','Modelo mostrado no catálogo enviado; informações sob consulta.',null::numeric,10),
  ('CARLA-PIJ-001','pijamas','Pijama Feminino de Botão em Suede Canelado','Consulte estampas, cores e tamanhos.',null::numeric,20),
  ('CARLA-BAB-001','baby-doll','Baby-doll rendado','Peça com detalhes delicados de renda.',109.90,30),
  ('CARLA-CAM-001','camisolas','Camisola com Calcinha','Consulte as cores, rendas e tamanhos disponíveis.',124.90,40),
  ('CARLA-SUT-001','sutias','Sutiã Comfort Bojo Removível','Consulte cores e tamanhos.',99.90,50),
  ('CARLA-PIJ-002','pijamas','Pijama Suede','Conforto e delicadeza para as noites.',139.90,60),
  ('CARLA-CAL-017','calcinhas','Calcinha Avulsa — Referência 017','Consulte cores, modelos e tamanhos.',null::numeric,70),
  ('CARLA-SUT-002','sutias','Sutiã Laser Termofusionado','Com bojo removível.',124.90,80),
  ('CARLA-SUT-003','sutias','Sutiã Comfort com Bojo','Consulte opções e tamanhos.',89.90,90)
)
insert into public.carla_products (sku,category_id,name,description,price,sort_order,active)
select catalog.sku,cat.id,catalog.name,catalog.description,catalog.price,catalog.sort_order,true
from catalog join public.carla_categories cat on cat.slug=catalog.cat
on conflict (sku) do nothing;

-- Passo manual e seguro, APOS criar a conta pelo painel Auth > Users:
-- Substitua email pelo email real da proprietaria e execute separadamente.
-- insert into public.carla_admin_users (user_id,role)
-- select id, 'owner' from auth.users where email = 'EMAIL_DA_PROPRIETARIA'
-- on conflict (user_id) do update set role='owner';
