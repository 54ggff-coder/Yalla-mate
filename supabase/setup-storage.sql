-- Setup Supabase Storage Buckets and Policies

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('reels-videos', 'reels-videos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reels-thumbnails', 'reels-thumbnails', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('place-images', 'place-images', true) ON CONFLICT (id) DO NOTHING;

-- UPDATE bucket configurations (Mime types and File size limits - Note: These are usually set via API, but we can enforce some level of restriction or setup in SQL)

-- 2. Define Policies (Example for a public bucket)
-- For public read:
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'place-images'));
-- For private read (chat-images):
CREATE POLICY "Private Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat-images' AND auth.uid() IS NOT NULL);

-- User-specific upload policy (example pattern for authenticated uploads)
CREATE POLICY "User Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'chat-images', 'place-images') AND auth.uid() IS NOT NULL);
CREATE POLICY "User Update Access" ON storage.objects FOR UPDATE USING (bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'chat-images', 'place-images') AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "User Delete Access" ON storage.objects FOR DELETE USING (bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'chat-images', 'place-images') AND auth.uid()::text = (storage.foldername(name))[1]);
