
-- ============ Categories ============
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_categories_business ON public.expense_categories(business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biz members manage expense categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER tg_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Recurring interval enum ============
CREATE TYPE public.expense_recurring_interval AS ENUM ('daily','weekly','monthly','yearly');

-- ============ Expenses ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.business_locations(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ref_no TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_paid NUMERIC(20,4) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'due',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval public.expense_recurring_interval,
  recurring_next_date DATE,
  recurring_end_date DATE,
  is_recurring_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_business ON public.expenses(business_id);
CREATE INDEX idx_expenses_date ON public.expenses(business_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biz members manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER tg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Payments ============
CREATE TABLE public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  amount NUMERIC(20,4) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  paid_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_payments_expense ON public.expense_payments(expense_id);
CREATE INDEX idx_expense_payments_business ON public.expense_payments(business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_payments TO authenticated;
GRANT ALL ON public.expense_payments TO service_role;
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biz members manage expense payments" ON public.expense_payments
  FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

-- ============ Payment sync trigger ============
CREATE OR REPLACE FUNCTION public.sync_expense_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id UUID := COALESCE(NEW.expense_id, OLD.expense_id);
  v_paid NUMERIC;
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_paid
    FROM public.expense_payments WHERE expense_id = v_expense_id;
  SELECT total_amount INTO v_total FROM public.expenses WHERE id = v_expense_id;
  UPDATE public.expenses
    SET total_paid = v_paid,
        payment_status = CASE
          WHEN v_paid >= COALESCE(v_total,0) AND COALESCE(v_total,0) > 0 THEN 'paid'::payment_status
          WHEN v_paid > 0 THEN 'partial'::payment_status
          ELSE 'due'::payment_status
        END,
        updated_at = now()
    WHERE id = v_expense_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_expense_payments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_paid();
