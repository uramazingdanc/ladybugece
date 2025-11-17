-- Fix recursive RLS checks and enable public read for farms (for public dashboard)
-- 1) Helper function to check government role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_government(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id AND p.role = 'government'::public.app_role
  );
$$;

-- 2) Recreate government-view policies to use the helper
-- Farms
DROP POLICY IF EXISTS "Government can view all farms" ON public.farms;
CREATE POLICY "Government can view all farms"
ON public.farms
FOR SELECT
USING (public.is_government(auth.uid()));

-- Public read for farms to support unauthenticated dashboard
DROP POLICY IF EXISTS "Public can view farms" ON public.farms;
CREATE POLICY "Public can view farms"
ON public.farms
FOR SELECT
USING (true);

-- Devices
DROP POLICY IF EXISTS "Government can view all devices" ON public.devices;
CREATE POLICY "Government can view all devices"
ON public.devices
FOR SELECT
USING (public.is_government(auth.uid()));

-- Pest readings
DROP POLICY IF EXISTS "Government can view all readings" ON public.pest_readings;
CREATE POLICY "Government can view all readings"
ON public.pest_readings
FOR SELECT
USING (public.is_government(auth.uid()));

-- IPM alerts
DROP POLICY IF EXISTS "Government can view all alerts" ON public.ipm_alerts;
CREATE POLICY "Government can view all alerts"
ON public.ipm_alerts
FOR SELECT
USING (public.is_government(auth.uid()));

-- Profiles (avoid self-referencing policy recursion)
DROP POLICY IF EXISTS "Government can view all profiles" ON public.profiles;
CREATE POLICY "Government can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_government(auth.uid()));