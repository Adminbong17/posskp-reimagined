import { createFileRoute } from "@tanstack/react-router";
import { Factory } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/manufacturing")({
  head: () => ({ meta: [{ title: "Manufacturing — QweekPOS" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Factory}
      title="Manufacturing"
      description="Recipes, production runs, and raw-material consumption."
      features={[
        "Bill of Materials (BOM) per finished product",
        "Production orders with automatic raw-material deduction",
        "Yield & wastage tracking",
        "Costing rolled up to finished goods",
      ]}
    />
  ),
});
