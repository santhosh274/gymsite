-- Function called AFTER signUp creates the Auth user, to:
-- 1. Verify the caller is an admin
-- 2. Insert the auth table mapping (ID No → email)
-- 3. Return confirmation
-- The handle_new_user trigger handles profile and user_roles creation.
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_id_no text,
  p_password text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Create auth table mapping (ID No → email for custom login)
  INSERT INTO public.auth (user_id, password, role, email)
  VALUES (p_id_no, p_password, 'member', p_email)
  ON CONFLICT (user_id) DO UPDATE
    SET password = EXCLUDED.password,
        email = EXCLUDED.email,
        role = 'member';

  RETURN jsonb_build_object('user_id', p_id_no, 'email', p_email);
END;
$$;

-- Grant execute to authenticated users (admin check is internal)
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated, anon;
