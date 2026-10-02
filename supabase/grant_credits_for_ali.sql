-- Run this once in Supabase Dashboard → SQL Editor.
-- This adds 100 credits to the requested account without overwriting existing credits.
-- Run with the SQL Editor (service/admin context), not from the client app.

UPDATE public.profiles
SET credits = credits + 100
WHERE id = (
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower('heyitsali.jan313@gmail.com')
);

-- Verify the result:
SELECT u.email, p.credits
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('heyitsali.jan313@gmail.com');
