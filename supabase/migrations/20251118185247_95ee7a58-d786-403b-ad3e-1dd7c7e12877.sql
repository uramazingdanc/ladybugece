-- Allow public read access to pest_readings for the public dashboard
CREATE POLICY "Public can view pest readings"
ON public.pest_readings
FOR SELECT
USING (true);