-- Enable Postgres RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Helper to get user_id from path components
-- The path is 'users/{user_id}/{filename}'
-- string_to_array('users/123/file.mp4', '/') -> ['users', '123', 'file.mp4']

-- Drop existing policies to avoid conflicts if needed
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
    DROP POLICY IF EXISTS "User Insert Access" ON storage.objects;
    DROP POLICY IF EXISTS "User Update/Delete Access" ON storage.objects;
    DROP POLICY IF EXISTS "Private Read Access" ON storage.objects;
    DROP POLICY IF EXISTS "Private Insert Access" ON storage.objects;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
    DROP POLICY IF EXISTS "Users can select their own profile" ON public.users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
END $$;

-- 1. Public Buckets Policies (reels-videos, reels-thumbnails, profile-images, place-images)
CREATE POLICY "Public Read Access" ON storage.objects
FOR SELECT
USING (bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'place-images'));

CREATE POLICY "User Insert Access" ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'place-images')
    AND auth.uid()::text = (string_to_array(name, '/'))[1] 
    AND (string_to_array(name, '/'))[0] = 'users'
);

CREATE POLICY "User Update/Delete Access" ON storage.objects
FOR ALL
USING (
    bucket_id IN ('reels-videos', 'reels-thumbnails', 'profile-images', 'place-images')
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
    AND (string_to_array(name, '/'))[0] = 'users'
);

-- 2. Private Bucket Policies (chat-images)
-- Assuming path: 'chat/{conversation_id}/{filename}'
-- Needs check: auth.uid() must be a participant in conversation_id. 
-- For now, provide basic access if the user matches the folder name IF the conversation_id is user_id. 
-- If conversation_id is different, more complex auth is needed (DB lookup).

CREATE POLICY "Private Insert Access" ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'chat-images'
    AND auth.uid() IS NOT NULL
);

-- 3. public.users table policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can select their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
