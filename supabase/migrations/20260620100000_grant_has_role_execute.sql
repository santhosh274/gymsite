-- Grant EXECUTE on has_role to anon and authenticated roles
-- This function is used in RLS policies across all tables (user_roles, profiles, payments, leaves, etc.)
-- Without this grant, any query hitting an RLS policy referencing has_role would fail with
-- "permission denied for function has_role"
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon;
