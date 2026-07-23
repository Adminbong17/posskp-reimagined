-- Backfill latest purchase price into variations & products from purchase history
WITH latest AS (
  SELECT DISTINCT ON (tpl.variation_id)
    tpl.variation_id,
    tpl.product_id,
    tpl.purchase_price
  FROM public.transaction_purchase_lines tpl
  JOIN public.transactions t ON t.id = tpl.transaction_id
  WHERE t.type = 'purchase' AND t.status = 'received'
  ORDER BY tpl.variation_id, t.transaction_date DESC, t.created_at DESC
)
UPDATE public.variations v
SET default_purchase_price = l.purchase_price,
    dpp_inc_tax = l.purchase_price,
    updated_at = now()
FROM latest l
WHERE v.id = l.variation_id
  AND COALESCE(l.purchase_price,0) > 0;

WITH latest AS (
  SELECT DISTINCT ON (tpl.product_id)
    tpl.product_id,
    tpl.purchase_price
  FROM public.transaction_purchase_lines tpl
  JOIN public.transactions t ON t.id = tpl.transaction_id
  WHERE t.type = 'purchase' AND t.status = 'received'
  ORDER BY tpl.product_id, t.transaction_date DESC, t.created_at DESC
)
UPDATE public.products p
SET default_purchase_price = l.purchase_price,
    updated_at = now()
FROM latest l
WHERE p.id = l.product_id
  AND COALESCE(l.purchase_price,0) > 0;