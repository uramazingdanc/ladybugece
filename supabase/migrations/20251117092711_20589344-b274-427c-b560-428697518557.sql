-- Allow public users to insert farms (for unauthenticated public dashboard)
DROP POLICY IF EXISTS "Farmers can insert own farms" ON public.farms;
CREATE POLICY "Public can insert farms" 
ON public.farms 
FOR INSERT 
WITH CHECK (true);

-- Allow public users to update farms
DROP POLICY IF EXISTS "Farmers can update own farms" ON public.farms;
CREATE POLICY "Public can update farms" 
ON public.farms 
FOR UPDATE 
USING (true);

-- Allow public users to delete farms
DROP POLICY IF EXISTS "Farmers can delete own farms" ON public.farms;
CREATE POLICY "Public can delete farms" 
ON public.farms 
FOR DELETE 
USING (true);