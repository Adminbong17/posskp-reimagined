CREATE OR REPLACE FUNCTION public.delete_stock_adjustment(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_adjustment public.stock_adjustments%ROWTYPE;
  v_line public.stock_adjustment_lines%ROWTYPE;
  v_uid uuid := auth.uid();
  v_delta numeric;
  v_available numeric;
BEGIN
  SELECT * INTO v_adjustment
  FROM public.stock_adjustments
  WHERE id = _id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock adjustment not found';
  END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_adjustment.business_id) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;

  FOR v_line IN
    SELECT * FROM public.stock_adjustment_lines WHERE stock_adjustment_id = _id
  LOOP
    v_delta := CASE WHEN v_adjustment.adjustment_type = 'normal' THEN -v_line.quantity ELSE v_line.quantity END;
    IF v_delta < 0 THEN
      SELECT COALESCE(qty_available, 0)
      INTO v_available
      FROM public.variation_location_details
      WHERE variation_id = v_line.variation_id
        AND location_id = v_adjustment.location_id
      FOR UPDATE;
      IF COALESCE(v_available, 0) < abs(v_delta) THEN
        RAISE EXCEPTION 'Cannot reverse adjustment because current stock is insufficient';
      END IF;
    END IF;

    UPDATE public.variation_location_details
    SET qty_available = qty_available + v_delta,
        updated_at = now()
    WHERE variation_id = v_line.variation_id
      AND location_id = v_adjustment.location_id;
  END LOOP;

  DELETE FROM public.stock_adjustment_lines WHERE stock_adjustment_id = _id;
  DELETE FROM public.stock_adjustments WHERE id = _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_stock_adjustment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_stock_adjustment(uuid) TO authenticated, service_role;