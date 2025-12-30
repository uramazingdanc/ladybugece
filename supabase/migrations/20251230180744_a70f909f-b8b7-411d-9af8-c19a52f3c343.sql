-- Add larva_density column to pest_readings table
ALTER TABLE public.pest_readings 
ADD COLUMN IF NOT EXISTS larva_density double precision DEFAULT NULL;

-- Add larva_density to ipm_alerts for live tracking
ALTER TABLE public.ipm_alerts 
ADD COLUMN IF NOT EXISTS last_larva_density double precision DEFAULT NULL;

-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_readings_with_farms(timestamp with time zone, timestamp with time zone);

CREATE FUNCTION public.get_readings_with_farms(start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE(
  created_at timestamp with time zone,
  moth_count integer,
  temperature double precision,
  larva_density double precision,
  device_id text,
  farm_id uuid,
  farm_name text,
  latitude double precision,
  longitude double precision,
  alert_level alert_level
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pr.created_at,
    pr.moth_count,
    pr.temperature,
    pr.larva_density,
    pr.device_id,
    f.id as farm_id,
    f.farm_name,
    f.latitude,
    f.longitude,
    ia.alert_level
  FROM pest_readings pr
  JOIN devices d ON pr.device_id = d.id
  JOIN farms f ON d.farm_id = f.id
  LEFT JOIN ipm_alerts ia ON f.id = ia.farm_id
  WHERE pr.created_at >= start_date
    AND pr.created_at <= end_date
  ORDER BY pr.created_at DESC;
$$;