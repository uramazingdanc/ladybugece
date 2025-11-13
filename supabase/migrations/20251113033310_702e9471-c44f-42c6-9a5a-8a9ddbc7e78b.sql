-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('farmer', 'government');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'farmer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Government can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'government'
  ));

-- Create farms table
CREATE TABLE public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farm_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on farms
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- Farms policies
CREATE POLICY "Farmers can view own farms"
  ON public.farms FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Farmers can insert own farms"
  ON public.farms FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Farmers can update own farms"
  ON public.farms FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Farmers can delete own farms"
  ON public.farms FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "Government can view all farms"
  ON public.farms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'government'
  ));

-- Create devices table
CREATE TABLE public.devices (
  id text PRIMARY KEY,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Devices policies
CREATE POLICY "Farmers can view own devices"
  ON public.devices FOR SELECT
  USING (farm_id IN (
    SELECT id FROM public.farms WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Farmers can insert own devices"
  ON public.devices FOR INSERT
  WITH CHECK (farm_id IN (
    SELECT id FROM public.farms WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Farmers can update own devices"
  ON public.devices FOR UPDATE
  USING (farm_id IN (
    SELECT id FROM public.farms WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Farmers can delete own devices"
  ON public.devices FOR DELETE
  USING (farm_id IN (
    SELECT id FROM public.farms WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Government can view all devices"
  ON public.devices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'government'
  ));

-- Create pest_readings table
CREATE TABLE public.pest_readings (
  id bigserial PRIMARY KEY,
  device_id text NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  moth_count int NOT NULL CHECK (moth_count >= 0),
  temperature double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on pest_readings
ALTER TABLE public.pest_readings ENABLE ROW LEVEL SECURITY;

-- Pest readings policies
CREATE POLICY "Farmers can view own readings"
  ON public.pest_readings FOR SELECT
  USING (device_id IN (
    SELECT d.id FROM public.devices d
    JOIN public.farms f ON d.farm_id = f.id
    WHERE f.owner_id = auth.uid()
  ));

CREATE POLICY "Government can view all readings"
  ON public.pest_readings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'government'
  ));

-- Create alert_level enum
CREATE TYPE public.alert_level AS ENUM ('Green', 'Yellow', 'Red');

-- Create ipm_alerts table
CREATE TABLE public.ipm_alerts (
  farm_id uuid PRIMARY KEY REFERENCES public.farms(id) ON DELETE CASCADE,
  alert_level public.alert_level NOT NULL DEFAULT 'Green',
  last_updated timestamptz NOT NULL DEFAULT now(),
  last_moth_count int NOT NULL DEFAULT 0
);

-- Enable RLS on ipm_alerts
ALTER TABLE public.ipm_alerts ENABLE ROW LEVEL SECURITY;

-- IPM alerts policies
CREATE POLICY "Farmers can view own alerts"
  ON public.ipm_alerts FOR SELECT
  USING (farm_id IN (
    SELECT id FROM public.farms WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Government can view all alerts"
  ON public.ipm_alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'government'
  ));

CREATE POLICY "Public can view alert levels"
  ON public.ipm_alerts FOR SELECT
  USING (true);

-- Enable realtime for ipm_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.ipm_alerts;

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'farmer')
  );
  RETURN new;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_farms_updated_at
  BEFORE UPDATE ON public.farms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();