/*
# Create profiles and videos tables for AI video generation platform

1. New Tables
  - `profiles`: extends Supabase auth.users with a display name, avatar URL, bio, and plan tier.
    - `id` (uuid, PK, references auth.users)
    - `username` (text, unique)
    - `full_name` (text)
    - `avatar_url` (text)
    - `bio` (text)
    - `plan` (text: free/pro/studio)
    - `credits` (int, default 10)
    - `created_at` (timestamptz)
  - `videos`: stores generated video records.
    - `id` (uuid, PK)
    - `user_id` (uuid, FK → profiles.id, DEFAULT auth.uid())
    - `title` (text)
    - `prompt` (text, the text prompt used)
    - `style` (text: cinematic/anime/realistic/3d-render/etc)
    - `status` (text: processing/completed/failed)
    - `thumbnail_url` (text)
    - `video_url` (text)
    - `duration` (int, seconds)
    - `aspect_ratio` (text: 16:9/9:16/1:1)
    - `is_public` (boolean, default true)
    - `likes_count` (int, default 0)
    - `views_count` (int, default 0)
    - `model` (text: which AI model was used)
    - `created_at` (timestamptz)

2. Security
  - RLS enabled on both tables.
  - profiles: authenticated users can SELECT all profiles (for discover feed),
    but can UPDATE only their own profile. INSERT is auto-handled via a trigger.
  - videos: authenticated users can SELECT all public videos + their own private ones.
    INSERT/UPDATE/DELETE scoped to owner.
  - A trigger auto-creates a profile row when a new auth user signs up.
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  bio text DEFAULT '',
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'studio')),
  credits int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view profiles (needed for discover feed + avatars)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT TO authenticated USING (true);

-- Users can update only their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Users can insert their own profile row (used by the trigger / manual signup)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================================
-- VIDEOS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  style text NOT NULL DEFAULT 'cinematic',
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  thumbnail_url text DEFAULT '',
  video_url text DEFAULT '',
  duration int NOT NULL DEFAULT 5,
  aspect_ratio text NOT NULL DEFAULT '16:9',
  is_public boolean NOT NULL DEFAULT true,
  likes_count int NOT NULL DEFAULT 0,
  views_count int NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'neura-motion-v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Users can view all public videos + their own private ones
DROP POLICY IF EXISTS "videos_select_visible" ON videos;
CREATE POLICY "videos_select_visible"
  ON videos FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = user_id);

-- Owner can insert
DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own"
  ON videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner can update
DROP POLICY IF EXISTS "videos_update_own" ON videos;
CREATE POLICY "videos_update_own"
  ON videos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Owner can delete
DROP POLICY IF EXISTS "videos_delete_own" ON videos;
CREATE POLICY "videos_delete_own"
  ON videos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'bio', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_public ON videos(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
