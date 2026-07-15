import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CompleteSchema = z.object({
  order_id: z.string().uuid(),
  produced_qty: z.number().positive(),
  wastage_qty: z.number().min(0).default(0),
  lines: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variation_id: z.string().uuid(),
        planned_qty: z.number().min(0).default(0),
        actual_qty: z.number().min(0),
        unit_cost: z.number().min(0).default(0),
      }),
    )
    .min(1),
});

export const completeProductionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { order_id, ...payload } = data;
    const { data: result, error } = await context.supabase.rpc("complete_production_order", {
      _id: order_id,
      _payload: payload,
    });
    if (error) throw new Error(error.message);
    return { id: result as string };
  });