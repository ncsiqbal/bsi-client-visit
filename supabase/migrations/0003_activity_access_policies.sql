
-- BSI Client Visit Management System
-- Migration 0003: Activity read access policies
--
-- This migration grants read access only.
-- Write and review permissions will be added separately
-- after enforcing safe activity status transitions.

-- Sales: read only their own activities.
CREATE POLICY "activities_select_sales_own"
ON public.activities
FOR SELECT
TO authenticated
USING (
  (SELECT public.current_app_role()) = 'sales'
  AND sales_id = (SELECT auth.uid())
);

-- Supervisor: read all activities for review.
CREATE POLICY "activities_select_supervisor_all"
ON public.activities
FOR SELECT
TO authenticated
USING (
  (SELECT public.current_app_role()) = 'supervisor'
);

-- Management: read only approved activities.
CREATE POLICY "activities_select_management_approved"
ON public.activities
FOR SELECT
TO authenticated
USING (
  (SELECT public.current_app_role()) = 'management'
  AND status = 'approved'
);

-- Admin: read all activities.
CREATE POLICY "activities_select_admin_all"
ON public.activities
FOR SELECT
TO authenticated
USING (
  (SELECT public.current_app_role()) = 'admin'
);
