-- Add degree_days column to pest_readings table for edge-computed values
ALTER TABLE public.pest_readings 
ADD COLUMN IF NOT EXISTS degree_days double precision;