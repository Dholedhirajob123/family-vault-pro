CREATE OR REPLACE FUNCTION public.verify_member_password(_slug text, _password text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE h text;
BEGIN
  SELECT password_hash INTO h FROM public.family_members WHERE slug = _slug;
  IF h IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN h = crypt(_password, h);
END $function$;