-- Add last_temperature column to ipm_alerts table
ALTER TABLE public.ipm_alerts 
ADD COLUMN last_temperature double precision;