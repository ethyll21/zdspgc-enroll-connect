
CREATE POLICY "Students manage own enrollment docs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'enrollment-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (bucket_id = 'enrollment-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
