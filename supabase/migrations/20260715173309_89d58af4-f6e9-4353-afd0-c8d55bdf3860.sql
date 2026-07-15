
-- ==========================================
-- Manufacturing module
-- ==========================================

-- BOM header
CREATE TABLE public.mfg_boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  finished_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  finished_variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE RESTRICT,
  output_qty NUMERIC NOT NULL DEFAULT 1 CHECK (output_qty > 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mfg_bom_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.mfg_boms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE mfg_order_status AS ENUM ('draft','in_progress','completed','cancelled');

CREATE TABLE public.mfg_production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE RESTRICT,
  bom_id UUID REFERENCES public.mfg_boms(id) ON DELETE SET NULL,
  ref_no TEXT,
  finished_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  finished_variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE RESTRICT,
  planned_qty NUMERIC NOT NULL DEFAULT 0,
  produced_qty NUMERIC NOT NULL DEFAULT 0,
  wastage_qty NUMERIC NOT NULL DEFAULT 0,
  yield_percent NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  status mfg_order_status NOT NULL DEFAULT 'draft',
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mfg_production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.mfg_production_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE RESTRICT,
  planned_qty NUMERIC NOT NULL DEFAULT 0,
  actual_qty NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfg_boms_business ON public.mfg_boms(business_id);
CREATE INDEX idx_mfg_bom_lines_bom ON public.mfg_bom_lines(bom_id);
CREATE INDEX idx_mfg_orders_business ON public.mfg_production_orders(business_id);
CREATE INDEX idx_mfg_order_lines_order ON public.mfg_production_lines(order_id);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfg_boms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfg_bom_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfg_production_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfg_production_lines TO authenticated;
GRANT ALL ON public.mfg_boms, public.mfg_bom_lines, public.mfg_production_orders, public.mfg_production_lines TO service_role;

-- RLS
ALTER TABLE public.mfg_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfg_production_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfg_boms_business" ON public.mfg_boms FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "mfg_bom_lines_business" ON public.mfg_bom_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mfg_boms b WHERE b.id = bom_id AND public.is_business_member(auth.uid(), b.business_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mfg_boms b WHERE b.id = bom_id AND public.is_business_member(auth.uid(), b.business_id)));

CREATE POLICY "mfg_orders_business" ON public.mfg_production_orders FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "mfg_order_lines_business" ON public.mfg_production_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mfg_production_orders o WHERE o.id = order_id AND public.is_business_member(auth.uid(), o.business_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mfg_production_orders o WHERE o.id = order_id AND public.is_business_member(auth.uid(), o.business_id)));

-- updated_at trigger
CREATE TRIGGER mfg_boms_updated_at BEFORE UPDATE ON public.mfg_boms
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER mfg_orders_updated_at BEFORE UPDATE ON public.mfg_production_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ==========================================
-- Complete production RPC:
--  - deducts raw materials from variation_location_details
--  - increments finished stock
--  - computes total_cost, unit_cost, yield_percent
-- ==========================================
CREATE OR REPLACE FUNCTION public.complete_production_order(_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.mfg_production_orders%ROWTYPE;
  v_uid uuid := auth.uid();
  v_produced numeric := COALESCE((_payload->>'produced_qty')::numeric, 0);
  v_wastage numeric := COALESCE((_payload->>'wastage_qty')::numeric, 0);
  v_lines jsonb := COALESCE(_payload->'lines', '[]'::jsonb);
  v_line jsonb;
  v_total_cost numeric := 0;
  v_qty numeric;
  v_unit_cost numeric;
  v_planned numeric;
  v_yield numeric := 0;
  v_avail numeric;
BEGIN
  SELECT * INTO v_order FROM public.mfg_production_orders WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production order not found'; END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_order.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_order.status = 'completed' THEN
    RAISE EXCEPTION 'Order already completed';
  END IF;
  IF v_produced <= 0 THEN
    RAISE EXCEPTION 'Produced quantity must be positive';
  END IF;

  -- Clear old lines (if re-running) and re-insert
  DELETE FROM public.mfg_production_lines WHERE order_id = _id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_qty := COALESCE((v_line->>'actual_qty')::numeric, 0);
    v_unit_cost := COALESCE((v_line->>'unit_cost')::numeric, 0);
    v_planned := COALESCE((v_line->>'planned_qty')::numeric, v_qty);

    -- Check stock availability
    SELECT COALESCE(qty_available, 0) INTO v_avail
      FROM public.variation_location_details
      WHERE variation_id = (v_line->>'variation_id')::uuid
        AND location_id = v_order.location_id;
    IF COALESCE(v_avail,0) < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for raw material variation %', (v_line->>'variation_id');
    END IF;

    -- Deduct raw material
    UPDATE public.variation_location_details
      SET qty_available = qty_available - v_qty, updated_at = now()
      WHERE variation_id = (v_line->>'variation_id')::uuid
        AND location_id = v_order.location_id;

    INSERT INTO public.mfg_production_lines
      (order_id, product_id, variation_id, planned_qty, actual_qty, unit_cost, total_cost)
    VALUES (
      _id,
      (v_line->>'product_id')::uuid,
      (v_line->>'variation_id')::uuid,
      v_planned, v_qty, v_unit_cost, v_qty * v_unit_cost
    );

    v_total_cost := v_total_cost + (v_qty * v_unit_cost);
  END LOOP;

  -- Add finished goods to stock
  INSERT INTO public.variation_location_details
    (product_id, variation_id, location_id, qty_available)
  VALUES
    (v_order.finished_product_id, v_order.finished_variation_id, v_order.location_id, v_produced)
  ON CONFLICT (variation_id, location_id) DO UPDATE
    SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available,
        updated_at = now();

  IF (v_produced + v_wastage) > 0 THEN
    v_yield := (v_produced / (v_produced + v_wastage)) * 100;
  END IF;

  UPDATE public.mfg_production_orders
    SET produced_qty = v_produced,
        wastage_qty = v_wastage,
        total_cost = v_total_cost,
        unit_cost = CASE WHEN v_produced > 0 THEN v_total_cost / v_produced ELSE 0 END,
        yield_percent = v_yield,
        status = 'completed',
        updated_at = now()
    WHERE id = _id;

  RETURN _id;
END;
$$;
