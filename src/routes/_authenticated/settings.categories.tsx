import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";

export const Route = createFileRoute("/_authenticated/settings/categories")({
  component: () => (
    <MasterDataTable
      table="categories"
      title="Categories"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "short_code", label: "Short code" },
        { key: "description", label: "Description" },
      ]}
      listColumns={[
        { key: "name", label: "Name" },
        { key: "short_code", label: "Code" },
      ]}
    />
  ),
});
