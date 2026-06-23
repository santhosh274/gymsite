CREATE TABLE IF NOT EXISTS public.member_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('workout', 'diet')),
  title text NOT NULL,
  content text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all" ON public.member_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Member read own" ON public.member_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON public.member_plans TO authenticated, anon;
