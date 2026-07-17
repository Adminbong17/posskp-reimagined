
-- Super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'admin@bongbangla.top');
$$;

-- Request status enum
DO $$ BEGIN
  CREATE TYPE public.biz_request_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- business_requests table
CREATE TABLE public.business_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  currency_id bigint NOT NULL,
  sku_prefix text,
  location_name text NOT NULL DEFAULT 'Main Location',
  status public.biz_request_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  business_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.business_requests TO authenticated;
GRANT ALL ON public.business_requests TO service_role;

ALTER TABLE public.business_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user views own request" ON public.business_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "user submits own request" ON public.business_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "admin updates any" ON public.business_requests
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_biz_req_updated BEFORE UPDATE ON public.business_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Restrict direct business INSERT: only super admin (RPC uses SECURITY DEFINER to bypass)
DROP POLICY IF EXISTS "Users can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can create own businesses" ON public.businesses;
DROP POLICY IF EXISTS "authenticated create business" ON public.businesses;

CREATE POLICY "only super admin direct insert" ON public.businesses
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) AND owner_id = auth.uid());

-- Approve function
CREATE OR REPLACE FUNCTION public.approve_business_request(_id uuid, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.business_requests%ROWTYPE;
  v_biz_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only super admin can approve business requests';
  END IF;
  SELECT * INTO v_req FROM public.business_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_req.status; END IF;

  INSERT INTO public.businesses (name, currency_id, sku_prefix, owner_id)
  VALUES (v_req.name, v_req.currency_id, v_req.sku_prefix, v_req.user_id)
  RETURNING id INTO v_biz_id;

  INSERT INTO public.business_locations (business_id, name, location_id)
  VALUES (v_biz_id, v_req.location_name, 'BL0001');

  UPDATE public.business_requests
    SET status = 'approved', admin_notes = _notes, reviewed_by = v_uid,
        reviewed_at = now(), business_id = v_biz_id, updated_at = now()
    WHERE id = _id;

  RETURN v_biz_id;
END $$;

-- Reject function
CREATE OR REPLACE FUNCTION public.reject_business_request(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only super admin can reject business requests';
  END IF;
  UPDATE public.business_requests
    SET status = 'rejected', admin_notes = _notes, reviewed_by = v_uid, reviewed_at = now(), updated_at = now()
    WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
END $$;
