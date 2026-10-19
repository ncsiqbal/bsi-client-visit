-- BSI Client Visit Management System
-- Migration 0002: Baseline RLS policies
-- Transaction tables intentionally remain inaccessible
-- until role-based access rules are implemented and tested.

-- Read the current user's active application role.
-- SECURITY DEFINER avoids recursive RLS checks on profiles.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
    and p.is_active = true
  limit 1;
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

-- Profiles: user can read their own profile; Admin can read all.
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.current_app_role()) = 'admin'
);

-- Master activity types: authenticated users can read active types.
create policy "activity_types_select_active"
on public.activity_types
for select
to authenticated
using (is_active = true);

-- Master products: authenticated users can read active products.
create policy "products_select_active"
on public.products
for select
to authenticated
using (is_active = true);

-- No policies are added yet for customers, activities, activity_details,
-- evidences, reviews, or audit_logs.
-- With RLS enabled, access to these tables remains denied to API roles
-- unless an applicable policy or privileged server-side operation exists.
