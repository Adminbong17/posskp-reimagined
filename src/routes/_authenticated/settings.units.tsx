import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";

export const Route = createFileRoute("/_authenticated/settings/units")({
  component: () => (
    <MasterDataTable
      table="units"
      title="Units"
      orderBy="actual_name"
      fields={[
        { key: "actual_name", label: "Name", required: true, placeholder: "Pieces" },
        { key: "short_name", label: "Short name", required: true, placeholder: "Pc(s)" },
        { key: "allow_decimal", label: "Allow decimal", type: "checkbox" },
      ]}
      listColumns={[
        { key: "actual_name", label: "Name" },
        { key: "short_name", label: "Short" },
        { key: "allow_decimal", label: "Decimal", render: (r) => r.allow_decimal ? "Yes" : "No" },
      ]}
    />
  ),
});

