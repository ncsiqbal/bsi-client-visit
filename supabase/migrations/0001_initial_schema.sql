-- BSI Client Visit Management System
-- Migration 0001: Initial database schema

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'sales',
  'supervisor',
  'management',
  'admin'
);

create type public.activity_status as enum (
  'draft',
  'submitted',
  'revision',
  'approved'
);

create type public.review_action as enum (
  'approved',
  'revision'
);

-- Profil aplikasi terhubung ke akun Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  employee_code text unique,
  position text,
  role public.app_role not null default 'sales',
  area text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Master customer.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique,
  name text not null,
  customer_type text not null,
  company_name text,
  contact_person text,
  phone text,
  email text,
  address text,
  village text,
  district text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint customers_longitude_range
    check (longitude is null or longitude between -180 and 180)
);

-- Master jenis aktivitas.
create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Master produk.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Transaksi aktivitas Sales.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_code text not null unique,
  sales_id uuid not null references public.profiles(id),
  customer_id uuid not null references public.customers(id),
  activity_type_id uuid not null references public.activity_types(id),
  activity_date timestamptz not null,
  status public.activity_status not null default 'draft',
  topic text not null,
  discussion text,
  result text not null,
  next_action text,
  next_action_date date,
  latitude double precision not null,
  longitude double precision not null,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_latitude_range
    check (latitude between -90 and 90),
  constraint activities_longitude_range
    check (longitude between -180 and 180)
);

-- Detail khusus seperti demplot dan closing.
create table public.activity_details (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id)
    on delete cascade,
  detail_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (activity_id, detail_type)
);

-- Metadata file bukti; file disimpan di object storage.
create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id)
    on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  evidence_type text not null default 'photo',
  latitude double precision not null,
  longitude double precision not null,
  captured_at timestamptz,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint evidences_latitude_range
    check (latitude between -90 and 90),
  constraint evidences_longitude_range
    check (longitude between -180 and 180)
);

-- Histori review, approval, dan permintaan revisi.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id)
    on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  action public.review_action not null,
  comments text,
  created_at timestamptz not null default now()
);

-- Audit trail dasar.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Indeks untuk pencarian dan laporan.
create index activities_sales_date_idx
  on public.activities (sales_id, activity_date desc);

create index activities_customer_date_idx
  on public.activities (customer_id, activity_date desc);

create index activities_status_date_idx
  on public.activities (status, activity_date desc);

create index evidences_activity_idx
  on public.evidences (activity_id);

create index reviews_activity_date_idx
  on public.reviews (activity_id, created_at desc);

create index customers_name_idx
  on public.customers using gin (to_tsvector('simple', name));

-- Jenis aktivitas awal untuk development.
insert into public.activity_types (code, name)
values
  ('PROSPECTING', 'Prospecting'),
  ('FOLLOW_UP', 'Follow Up'),
  ('DEMPLOT', 'Demplot'),
  ('CLOSING', 'Closing'),
  ('VISIT', 'Kunjungan'),
  ('SUPPORT', 'Aktivitas Pendukung')
on conflict do nothing;

-- Aktifkan RLS di seluruh tabel aplikasi.
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.activity_types enable row level security;
alter table public.products enable row level security;
alter table public.activities enable row level security;
alter table public.activity_details enable row level security;
alter table public.evidences enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_logs enable row level security;

-- Security policies akan ditambahkan sebelum aplikasi memakai data.
-- Jangan membuka akses tabel secara publik untuk melewati RLS.
