-- Enable realtime for pest_readings table only (ipm_alerts already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.pest_readings;