CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_site_password(_new_password text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _new_password IS NULL OR length(_new_password) = 0 THEN
    DELETE FROM public.app_settings WHERE key = 'site_password_hash';
  ELSE
    INSERT INTO public.app_settings(key, value, updated_at)
    VALUES ('site_password_hash', extensions.crypt(_new_password, extensions.gen_salt('bf')), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.verify_site_password(_password text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE h text;
BEGIN
  SELECT value INTO h FROM public.app_settings WHERE key = 'site_password_hash';
  IF h IS NULL THEN RETURN true; END IF;
  RETURN h = extensions.crypt(_password, h);
END $function$;

CREATE OR REPLACE FUNCTION public.set_member_password(_member_id uuid, _new_password text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _new_password IS NULL OR length(_new_password) = 0 THEN
    UPDATE public.family_members SET password_hash = NULL WHERE id = _member_id;
  ELSE
    UPDATE public.family_members
    SET password_hash = extensions.crypt(_new_password, extensions.gen_salt('bf'))
    WHERE id = _member_id;
  END IF;
  RETURN FOUND;
END $function$;

CREATE OR REPLACE FUNCTION public.verify_member_password(_slug text, _password text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE h text;
BEGIN
  SELECT password_hash INTO h FROM public.family_members WHERE slug = _slug;
  IF h IS NULL THEN RETURN FALSE; END IF;
  RETURN h = extensions.crypt(_password, h);
END $function$;