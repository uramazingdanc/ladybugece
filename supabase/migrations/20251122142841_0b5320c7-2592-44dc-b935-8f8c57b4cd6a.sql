-- Create a function to get pest readings with farm details
CREATE OR REPLACE FUNCTION get_readings_with_farms(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  created_at timestamptz,
  moth_count integer,
  temperature double precision,
  device_id text,
  farm_id uuid,
  farm_name text,
  latitude double precision,
  longitude double precision,
  alert_level alert_level
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pr.created_at,
    pr.moth_count,
    pr.temperature,
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