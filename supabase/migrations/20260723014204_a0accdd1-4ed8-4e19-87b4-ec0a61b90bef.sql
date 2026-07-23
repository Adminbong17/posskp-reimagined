CREATE OR REPLACE FUNCTION public.create_stock_adjustment(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_business_id uuid := (_payload->>'business_id')::uuid;
  v_location_id uuid := (_payload->>'location_id')::uuid;
  v_type public.stock_adjustment_type := COALESCE((_payload->>'adjustment_type')::public.stock_adjustment_type, 'normal');
  v_reason text := NULLIF(_payload->>'reason', '');
  v_ref_no text := COALESCE(NULLIF(_payload->>'ref_no', ''), 'SA' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'));
  v_lines jsonb := COALESCE(_payload->'lines', '[]'::jsonb);
  v_line jsonb;
  v_id uuid;
  v_uid uuid := auth.uid();
  v_product_id uuid;
  v_variation_id uuid;
  v_qty numeric;
  v_unit_price numeric;
  v_delta numeric;
  v_total numeric := 0;
  v_available numeric;
BEGIN
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_business_id) THEN
    RAISE EXCEPTION 'Not authorized for this business';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.business_locations
    WHERE id = v_location_id AND business_id = v_business_id
  ) THEN
    RAISE EXCEPTION 'Invalid location for this business';
  END IF;
  IF jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'At least one line is required';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variation_id := (v_line->>'variation_id')::uuid;
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_unit_price := COALESCE((v_line->>'unit_price')::numeric, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Adjustment quantity must be greater than zero';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.variations v
      JOIN public.products p ON p.id = v.product_id
      WHERE v.id = v_variation_id
        AND p.id = v_product_id
        AND p.business_id = v_business_id
    ) THEN
      RAISE EXCEPTION 'Invalid product or variation';
    END IF;

    v_delta := CASE WHEN v_type = 'normal' THEN v_qty ELSE -v_qty END;
    IF v_delta < 0 THEN
      SELECT COALESCE(qty_available, 0)
      INTO v_available
      FROM public.variation_location_details
      WHERE variation_id = v_variation_id AND location_id = v_location_id
      FOR UPDATE;
      IF COALESCE(v_available, 0) < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for variation % (available %, requested %)', v_variation_id, COALESCE(v_available, 0), v_qty;
      END IF;
    END IF;
    v_total := v_total + (v_qty * v_unit_price);
  END LOOP;

  INSERT INTO public.stock_adjustments (
    business_id, location_id, ref_no, adjustment_type, reason,
    total_amount, created_by
  ) VALUES (
    v_business_id, v_location_id, v_ref_no, v_type, v_reason,
    v_total, v_uid
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_variation_id := (v_line->>'variation_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_unit_price := COALESCE((v_line->>'unit_price')::numeric, 0);
    v_delta := CASE WHEN v_type = 'normal' THEN v_qty ELSE -v_qty END;

    INSERT INTO public.stock_adjustment_lines (
      stock_adjustment_id, product_id, variation_id, quantity, unit_price
    ) VALUES (
      v_id, v_product_id, v_variation_id, v_qty, v_unit_price
    );

    INSERT INTO public.variation_location_details (
      product_id, variation_id, location_id, qty_available
    ) VALUES (
      v_product_id, v_variation_id, v_location_id, v_delta
    )
    ON CONFLICT (variation_id, location_id) DO UPDATE
      SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available,
          updated_at = now();
  END LOOP;

  RETURN v_id;
END;
$function$;

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

  DELETE FROM public.stock_adjustments WHERE id = _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_stock_adjustment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_adjustment(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_stock_adjustment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_stock_adjustment(uuid) TO authenticated, service_role;