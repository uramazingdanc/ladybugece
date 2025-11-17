-- Make farms.owner_id nullable for public dashboard use case
ALTER TABLE public.farms ALTER COLUMN owner_id DROP NOT NULL;

-- Insert demo farms with NULL owner (since this is a public unauthenticated dashboard)
INSERT INTO public.farms (id, farm_name, owner_id, latitude, longitude)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', 'Manila Central Farm', NULL, 14.5995, 120.9842),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', 'Quezon City North Farm', NULL, 14.6760, 121.0437),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', 'Calamba South Farm', NULL, 14.4186, 121.0433),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004', 'Makati Urban Farm', NULL, 14.5547, 121.0244),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005', 'Pasig Valley Farm', NULL, 14.5764, 121.0851)
ON CONFLICT (id) DO NOTHING;

-- Insert alert levels for the demo farms
INSERT INTO public.ipm_alerts (farm_id, alert_level, last_moth_count, last_updated)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', 'Green', 5, now() - interval '2 hours'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', 'Yellow', 24, now() - interval '1 hour'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', 'Red', 63, now() - interval '15 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004', 'Green', 8, now() - interval '3 hours'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005', 'Yellow', 28, now() - interval '45 minutes')
ON CONFLICT (farm_id) DO UPDATE SET
  alert_level = EXCLUDED.alert_level,
  last_moth_count = EXCLUDED.last_moth_count,
  last_updated = EXCLUDED.last_updated;