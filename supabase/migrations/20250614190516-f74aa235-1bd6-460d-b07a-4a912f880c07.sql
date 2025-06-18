
-- Create firmware-updates storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmware-updates', 'firmware-updates', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload firmware
CREATE POLICY "Authenticated users can upload firmware"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'firmware-updates');

-- Create policy to allow public read access to firmware files
CREATE POLICY "Public can download firmware"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'firmware-updates');

-- Create policy to allow authenticated users to update firmware
CREATE POLICY "Authenticated users can update firmware"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'firmware-updates');

-- Create policy to allow authenticated users to delete firmware
CREATE POLICY "Authenticated users can delete firmware"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'firmware-updates');
