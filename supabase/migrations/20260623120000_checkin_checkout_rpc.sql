CREATE OR REPLACE FUNCTION public.checkin_member()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_count integer;
BEGIN
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

CREATE OR REPLACE FUNCTION public.checkout_member(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.attendance
  SET check_out = now()
  WHERE id = p_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkin_member TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.checkout_member TO authenticated, anon;
