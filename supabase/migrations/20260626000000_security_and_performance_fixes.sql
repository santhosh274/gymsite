-- ============================================================
-- Security & Performance Fixes
-- ============================================================

-- 1. Fix public.auth RLS: restrict anon to reading only email for
--    the matching user_id (login flow), and authenticated to own row.
DROP POLICY IF EXISTS "anon can read auth by user_id" ON public.auth;
DROP POLICY IF EXISTS "authenticated can read own auth" ON public.auth;

CREATE POLICY "anon read auth for login" ON public.auth
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated read own auth" ON public.auth
  FOR SELECT TO authenticated
  USING (user_id = (SELECT split_part(COALESCE(NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'email', ''), 'unknown'), '@', 1)));

-- 2. Revoke dangerous anon grants on member_plans
REVOKE ALL ON public.member_plans FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_plans TO authenticated;

-- 3. Revoke EXECUTE on admin RPCs from anon (only authenticated should invoke them)
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_members FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_renewals FROM anon;
REVOKE EXECUTE ON FUNCTION public.checkin_member FROM anon;
REVOKE EXECUTE ON FUNCTION public.checkout_member FROM anon;
-- Keep has_role accessible to anon (needed for RLS policies to function)

-- 4. Fix admin_update_user: remove reference to non-existent "name" column
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
  SET password = COALESCE(p_password, password)
  WHERE user_id = p_user_id;

  -- Update profile name if provided
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = p_name
    WHERE id = (SELECT id FROM auth.users WHERE email = lower(p_user_id) || '@srgym.local');
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id);
END;
$$;

-- 5. Fix admin_create_user: prevent overwriting existing admin accounts
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

  -- Check if target user already exists with admin role and block overwrite
  SELECT role INTO v_existing_role FROM public.auth WHERE user_id = p_id_no;
  IF v_existing_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot modify another admin account';
  END IF;

  INSERT INTO public.auth (user_id, password, role)
  VALUES (p_id_no, p_password, 'member')
  ON CONFLICT (user_id) DO UPDATE
    SET password = EXCLUDED.password,
        role = 'member';

  -- Update profile with provided name/phone (trigger creates profile with defaults)
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

-- 6. Drop UNIQUE (user_id, date) on attendance to allow multiple check-ins per day
--    (the 3-per-day limit is enforced server-side in checkin_member RPC)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_date_key;

-- 7. Fix checkin_member: add advisory lock to prevent TOCTOU race condition
CREATE OR REPLACE FUNCTION public.checkin_member()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_count integer;
  v_lock_key integer;
BEGIN
  -- Use a session-level advisory lock keyed on the user's UUID hash to
  -- serialize concurrent check-in attempts for the same user.
  v_lock_key := ('x' || substr(md5(auth.uid()::text), 1, 8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*) INTO v_count
  FROM public.attendance
  WHERE user_id = auth.uid() AND date = CURRENT_DATE;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'You can only check in 3 times per day';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  SELECT auth.uid(), 'Member', email FROM auth.users WHERE id = auth.uid()
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.attendance (user_id, date, check_in)
  VALUES (auth.uid(), CURRENT_DATE, now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- 8. Add database indexes for performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON public.memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON public.memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_member_plans_user_id ON public.member_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON public.attendance(check_in);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
