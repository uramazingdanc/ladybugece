-- Enable realtime for farms and devices tables
ALTER PUBLICATION supabase_realtime ADD TABLE farms;
ALTER PUBLICATION supabase_realtime ADD TABLE devices;

-- Set REPLICA IDENTITY FULL for all relevant tables to ensure full row data in realtime events
ALTER TABLE farms REPLICA IDENTITY FULL;
ALTER TABLE devices REPLICA IDENTITY FULL;
ALTER TABLE ipm_alerts REPLICA IDENTITY FULL;
ALTER TABLE pest_readings REPLICA IDENTITY FULL;