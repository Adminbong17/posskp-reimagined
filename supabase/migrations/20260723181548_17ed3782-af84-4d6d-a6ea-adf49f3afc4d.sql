
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.business_locations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  rx_no text,
  rx_date timestamptz NOT NULL DEFAULT now(),
  patient_name text NOT NULL,
  patient_age text,
  patient_gender text,
  patient_phone text,
  doctor_name text,
  doctor_qualification text,
  diagnosis text,
  vitals text,
  advice text,
  next_visit date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage prescriptions"
  ON public.prescriptions FOR ALL TO authenticated
  USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

CREATE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_prescriptions_business ON public.prescriptions(business_id, rx_date DESC);
CREATE INDEX idx_prescriptions_contact ON public.prescriptions(contact_id);

CREATE TABLE public.prescription_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id uuid REFERENCES public.variations(id) ON DELETE SET NULL,
  medicine_name text NOT NULL,
  dose text,
  frequency text,
  duration text,
  instructions text,
  quantity numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_lines TO authenticated;
GRANT ALL ON public.prescription_lines TO service_role;
ALTER TABLE public.prescription_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members manage prescription lines"
  ON public.prescription_lines FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.id = prescription_id AND public.is_business_member(auth.uid(), p.business_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.id = prescription_id AND public.is_business_member(auth.uid(), p.business_id)
  ));

CREATE TRIGGER trg_prescription_lines_updated_at
  BEFORE UPDATE ON public.prescription_lines
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_prescription_lines_rx ON public.prescription_lines(prescription_id);
