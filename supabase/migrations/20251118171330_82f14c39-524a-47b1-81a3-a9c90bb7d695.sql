-- Add public access policies for devices table to allow unauthenticated device management
-- This matches the public access pattern already in place for the farms table

CREATE POLICY "Public can insert devices" 
ON public.devices 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update devices" 
ON public.devices 
FOR UPDATE 
USING (true);

CREATE POLICY "Public can delete devices" 
ON public.devices 
FOR DELETE 
USING (true);

CREATE POLICY "Public can view devices" 
ON public.devices 
FOR SELECT 
USING (true);