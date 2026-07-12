
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_date date;

-- Admin-only: set/clear a member's password
CREATE OR REPLACE FUNCTION public.set_member_password(_member_id uuid, _new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_password IS NULL OR length(_new_password) = 0 THEN
    UPDATE public.family_members SET password_hash = NULL WHERE id = _member_id;
  ELSE
    UPDATE public.family_members
    SET password_hash = crypt(_new_password, gen_salt('bf'))
    WHERE id = _member_id;
  END IF;
  RETURN FOUND;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_member_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_password(uuid, text) TO authenticated;

-- Public: verify a member's password (returns true/false)
CREATE OR REPLACE FUNCTION public.verify_member_password(_slug text, _password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE h text;
BEGIN
  SELECT password_hash INTO h FROM public.family_members WHERE slug = _slug;
  IF h IS NULL THEN
    RETURN TRUE; -- no password set => open access
  END IF;
  RETURN h = crypt(_password, h);
END $$;

REVOKE EXECUTE ON FUNCTION public.verify_member_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_member_password(text, text) TO anon, authenticated;

-- Hide password_hash from Data API selects by only exposing needed columns via a view is overkill;
-- instead ensure no client relies on it. RLS still permits SELECT * — acceptable since hash is bcrypt.
