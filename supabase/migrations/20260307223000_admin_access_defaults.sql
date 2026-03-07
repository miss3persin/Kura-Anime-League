INSERT INTO public.admin_content (key, value)
VALUES (
  'admin_access_config',
  jsonb_build_object(
    'grants',
    jsonb_build_array(
      jsonb_build_object(
        'email', 'victor.segunigebello@gmail.com',
        'role', 'admin',
        'totalKp', 700000,
        'isSuspended', false
      )
    )
  )
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
  WHEN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(public.admin_content.value->'grants', '[]'::jsonb)) AS access_entry
    WHERE lower(access_entry->>'email') = 'victor.segunigebello@gmail.com'
  ) THEN public.admin_content.value
  ELSE jsonb_set(
    COALESCE(public.admin_content.value, '{}'::jsonb),
    '{grants}',
    COALESCE(public.admin_content.value->'grants', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'email', 'victor.segunigebello@gmail.com',
        'role', 'admin',
        'totalKp', 700000,
        'isSuspended', false
      )
    ),
    true
)
END;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  access_grant JSONB;
  initial_role TEXT := 'player';
  initial_total_kp INTEGER := 20000;
  initial_suspension BOOLEAN := false;
BEGIN
  SELECT access_entry
  INTO access_grant
  FROM public.admin_content content,
  LATERAL jsonb_array_elements(COALESCE(content.value->'grants', '[]'::jsonb)) AS access_entry
  WHERE content.key = 'admin_access_config'
    AND lower(access_entry->>'email') = lower(NEW.email)
  LIMIT 1;

  IF access_grant IS NOT NULL THEN
    initial_role := COALESCE(NULLIF(access_grant->>'role', ''), 'player');
    initial_total_kp := GREATEST(COALESCE((access_grant->>'totalKp')::INTEGER, 20000), 0);
    initial_suspension := COALESCE((access_grant->>'isSuspended')::BOOLEAN, false);
  END IF;

  INSERT INTO public.profiles (id, username, avatar_url, total_kp, role, is_suspended)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(COALESCE(NEW.email, NEW.id::TEXT), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    initial_total_kp,
    initial_role,
    initial_suspension
  );

  IF initial_role = 'admin' THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.profiles profile
SET
  role = 'admin',
  total_kp = 700000,
  is_suspended = false
FROM auth.users auth_user
WHERE profile.id = auth_user.id
  AND lower(auth_user.email) = 'victor.segunigebello@gmail.com';

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
WHERE lower(email) = 'victor.segunigebello@gmail.com';
