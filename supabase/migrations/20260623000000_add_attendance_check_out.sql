-- Add checkout time to attendance and FK for joins

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS check_out timestamptz;

-- FK for PostgREST nested select("*, profiles(...)")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

