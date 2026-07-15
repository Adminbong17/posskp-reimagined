-- Stock Transfers
CREATE TABLE public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ref_no TEXT,
  from_location_id UUID NOT NULL REFERENCES public.business_locations(id),
  to_location_id UUID NOT NULL REFERENCES public.business_locations(id),
  transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | in_transit | received | cancelled
  shipping_charges NUMERIC NOT NULL DEFAULT 0,
  additional_notes TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_transfers(business_id);
CREATE INDEX ON public.stock_transfers(from_location_id);
CREATE INDEX ON public.stock_transfers(to_location_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz members manage stock_transfers" ON public.stock_transfers
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER trg_stock_transfers_updated BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variation_id UUID NOT NULL REFERENCES public.variations(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_transfer_lines(transfer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_lines TO authenticated;
GRANT ALL ON public.stock_transfer_lines TO service_role;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz members manage transfer_lines" ON public.stock_transfer_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_transfers t WHERE t.id = transfer_id AND public.is_business_member(auth.uid(), t.business_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stock_transfers t WHERE t.id = transfer_id AND public.is_business_member(auth.uid(), t.business_id)));

-- Function: create/receive transfer with stock movement
CREATE OR REPLACE FUNCTION public.create_stock_transfer(_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_biz UUID := (_payload->>'business_id')::UUID;
  v_from UUID := (_payload->>'from_location_id')::UUID;
  v_to UUID := (_payload->>'to_location_id')::UUID;
  v_status TEXT := COALESCE(_payload->>'status','draft');
  v_ref TEXT := _payload->>'ref_no';
  v_date TIMESTAMPTZ := COALESCE((_payload->>'transfer_date')::TIMESTAMPTZ, now());
  v_ship NUMERIC := COALESCE((_payload->>'shipping_charges')::NUMERIC, 0);
  v_notes TEXT := _payload->>'additional_notes';
  v_lines JSONB := COALESCE(_payload->'lines','[]'::JSONB);
  v_line JSONB;
  v_total NUMERIC := 0;
  v_id UUID;
  v_uid UUID := auth.uid();
  v_qty NUMERIC; v_cost NUMERIC;
BEGIN
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_biz) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_from = v_to THEN RAISE EXCEPTION 'From and To locations must differ'; END IF;
  IF jsonb_array_length(v_lines) = 0 THEN RAISE EXCEPTION 'At least one line required'; END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_qty := COALESCE((v_line->>'quantity')::NUMERIC,0);
    v_cost := COALESCE((v_line->>'unit_cost')::NUMERIC,0);
    v_total := v_total + v_qty * v_cost;
  END LOOP;

  INSERT INTO public.stock_transfers (business_id, ref_no, from_location_id, to_location_id, transfer_date, status, shipping_charges, additional_notes, total_amount, created_by)
  VALUES (v_biz, v_ref, v_from, v_to, v_date, v_status, v_ship, v_notes, v_total + v_ship, v_uid)
  RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_qty := COALESCE((v_line->>'quantity')::NUMERIC,0);
    v_cost := COALESCE((v_line->>'unit_cost')::NUMERIC,0);
    INSERT INTO public.stock_transfer_lines (transfer_id, product_id, variation_id, quantity, unit_cost)
    VALUES (v_id, (v_line->>'product_id')::UUID, (v_line->>'variation_id')::UUID, v_qty, v_cost);

    IF v_status IN ('in_transit','received') THEN
      UPDATE public.variation_location_details
        SET qty_available = qty_available - v_qty, updated_at = now()
        WHERE variation_id = (v_line->>'variation_id')::UUID AND location_id = v_from;
    END IF;
    IF v_status = 'received' THEN
      INSERT INTO public.variation_location_details (product_id, variation_id, location_id, qty_available)
      VALUES ((v_line->>'product_id')::UUID, (v_line->>'variation_id')::UUID, v_to, v_qty)
      ON CONFLICT (variation_id, location_id) DO UPDATE
        SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available, updated_at = now();
    END IF;
  END LOOP;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.receive_stock_transfer(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t public.stock_transfers%ROWTYPE;
  v_l public.stock_transfer_lines%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO v_t FROM public.stock_transfers WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_t.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_t.status = 'received' THEN RETURN; END IF;

  FOR v_l IN SELECT * FROM public.stock_transfer_lines WHERE transfer_id = _id LOOP
    IF v_t.status = 'draft' THEN
      UPDATE public.variation_location_details
        SET qty_available = qty_available - v_l.quantity, updated_at = now()
        WHERE variation_id = v_l.variation_id AND location_id = v_t.from_location_id;
    END IF;
    INSERT INTO public.variation_location_details (product_id, variation_id, location_id, qty_available)
    VALUES (v_l.product_id, v_l.variation_id, v_t.to_location_id, v_l.quantity)
    ON CONFLICT (variation_id, location_id) DO UPDATE
      SET qty_available = public.variation_location_details.qty_available + EXCLUDED.qty_available, updated_at = now();
  END LOOP;

  UPDATE public.stock_transfers SET status = 'received', updated_at = now() WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_stock_transfer(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t public.stock_transfers%ROWTYPE;
  v_l public.stock_transfer_lines%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO v_t FROM public.stock_transfers WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_t.business_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_l IN SELECT * FROM public.stock_transfer_lines WHERE transfer_id = _id LOOP
    IF v_t.status IN ('in_transit','received') THEN
      UPDATE public.variation_location_details
        SET qty_available = qty_available + v_l.quantity, updated_at = now()
        WHERE variation_id = v_l.variation_id AND location_id = v_t.from_location_id;
    END IF;
    IF v_t.status = 'received' THEN
      UPDATE public.variation_location_details
        SET qty_available = qty_available - v_l.quantity, updated_at = now()
        WHERE variation_id = v_l.variation_id AND location_id = v_t.to_location_id;
    END IF;
  END LOOP;

  DELETE FROM public.stock_transfers WHERE id = _id;
END $$;

-- =====================
-- Accounts (Full Ledger)
-- =====================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank', -- bank | cash | card | other
  account_number TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.accounts(business_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz members manage accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL, -- deposit | withdraw | transfer_in | transfer_out | sale_payment | purchase_payment | expense_payment
  amount NUMERIC NOT NULL,
  tx_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_type TEXT, -- sale | purchase | expense | manual | transfer
  reference_id UUID,
  linked_account_id UUID REFERENCES public.accounts(id),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.account_transactions(business_id);
CREATE INDEX ON public.account_transactions(account_id);
CREATE INDEX ON public.account_transactions(reference_type, reference_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transactions TO authenticated;
GRANT ALL ON public.account_transactions TO service_role;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz members manage account_transactions" ON public.account_transactions
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

-- Trigger to keep account balance in sync
CREATE OR REPLACE FUNCTION public.sync_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sign NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_sign := CASE WHEN NEW.tx_type IN ('deposit','transfer_in','sale_payment') THEN 1 ELSE -1 END;
    UPDATE public.accounts SET current_balance = current_balance + (v_sign * NEW.amount), updated_at = now() WHERE id = NEW.account_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_sign := CASE WHEN OLD.tx_type IN ('deposit','transfer_in','sale_payment') THEN 1 ELSE -1 END;
    UPDATE public.accounts SET current_balance = current_balance - (v_sign * OLD.amount), updated_at = now() WHERE id = OLD.account_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_account_tx_balance
AFTER INSERT OR DELETE ON public.account_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance();

-- Function to transfer between accounts
CREATE OR REPLACE FUNCTION public.transfer_between_accounts(_from UUID, _to UUID, _amount NUMERIC, _note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_biz UUID; v_uid UUID := auth.uid();
BEGIN
  IF _from = _to THEN RAISE EXCEPTION 'From/To must differ'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT business_id INTO v_biz FROM public.accounts WHERE id = _from;
  IF v_uid IS NULL OR NOT public.is_business_member(v_uid, v_biz) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO public.account_transactions (business_id, account_id, tx_type, amount, reference_type, linked_account_id, note, created_by)
  VALUES (v_biz, _from, 'transfer_out', _amount, 'transfer', _to, _note, v_uid);
  INSERT INTO public.account_transactions (business_id, account_id, tx_type, amount, reference_type, linked_account_id, note, created_by)
  VALUES (v_biz, _to, 'transfer_in', _amount, 'transfer', _from, _note, v_uid);
END $$;