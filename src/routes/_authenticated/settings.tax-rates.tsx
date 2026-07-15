import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";

export const Route = createFileRoute("/_authenticated/settings/tax-rates")({
  component: () => (
    <MasterDataTable
      table="tax_rates"
      title="Tax Rates"
      fields={[
        { key: "name", label: "Name", required: true, placeholder: "VAT 5%" },
        { key: "amount", label: "Percentage (%)", type: "number", required: true, defaultValue: 0 },
        { key: "is_tax_group", label: "Tax group", type: "checkbox" },
      ]}
      listColumns={[
        { key: "name", label: "Name" },
        { key: "amount", label: "Amount %", render: (r) => `${r.amount}%` },
        { key: "is_tax_group", label: "Group", render: (r) => r.is_tax_group ? "Yes" : "No" },
      ]}
    />
  ),
});
