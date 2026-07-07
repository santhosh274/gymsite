-- ============================================================
-- Add name column to public.auth (source of truth for display names)
-- ============================================================

-- 1. Add name column
ALTER TABLE public.auth ADD COLUMN IF NOT EXISTS name text;

-- 2. Backfill from profiles where email matches
UPDATE public.auth a
SET name = p.full_name
FROM public.profiles p
WHERE (p.email = a.email OR p.email = lower(a.user_id) || '@srgym.local')
  AND a.name IS NULL;

-- 3. Update sync_auth_user to pass name as raw_user_meta_data
--    so handle_new_user picks it up and sets it on profiles.full_name
CREATE OR REPLACE FUNCTION public.sync_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_user_id uuid;
BEGIN
  v_email := lower(NEW.user_id) || '@srgym.local';

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous,
      confirmation_token, recovery_token,
      email_change_token_current, email_change_token_new,
      email_change, email_change_confirm_status
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid, v_user_id,
      'authenticated', 'authenticated', v_email,
      extensions.crypt(NEW.password, extensions.gen_salt('bf', 10)),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      CASE WHEN NEW.name IS NOT NULL THEN jsonb_build_object('full_name', NEW.name) ELSE '{}'::jsonb END,
      false, false,
      '', '', '', '',
      '', 0
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id::text, v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', false,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(NEW.password, extensions.gen_salt('bf', 10)),
        updated_at = now(),
        raw_user_meta_data = CASE
          WHEN NEW.name IS NOT NULL THEN
            raw_user_meta_data || jsonb_build_object('full_name', NEW.name)
          ELSE raw_user_meta_data
        END
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Update admin_create_user to set name on public.auth
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_id_no text,
  p_password text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_role text;
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  SELECT role INTO v_existing_role FROM public.auth WHERE user_id = p_id_no;
  IF v_existing_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot modify another admin account';
  END IF;

  INSERT INTO public.auth (user_id, password, role, name)
  VALUES (p_id_no, p_password, 'member', p_full_name)
  ON CONFLICT (user_id) DO UPDATE
    SET password = EXCLUDED.password,
        role = 'member',
        name = COALESCE(EXCLUDED.name, public.auth.name);

  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_id_no) || '@srgym.local';
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = COALESCE(p_full_name, full_name),
        phone = COALESCE(p_phone, phone)
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('user_id', p_id_no);
END;
$$;

-- 5. Update admin_update_user to set name on public.auth directly
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id text,
  p_password text DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;

  UPDATE public.auth
  SET password = COALESCE(p_password, password),
      name = COALESCE(p_name, name)
  WHERE user_id = p_user_id;

  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = p_name
    WHERE id = (SELECT id FROM auth.users WHERE email = lower(p_user_id) || '@srgym.local');
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id);
END;
$$;

-- 6. Update handle_new_user to also set public.auth.name from auth.users metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, address, emergency_contact)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'emergency_contact'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');

  UPDATE public.auth
  SET name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  WHERE user_id = split_part(NEW.email, '@', 1);

  RETURN NEW;
END; $$;

NOTIFY pgrst, 'reload schema';
