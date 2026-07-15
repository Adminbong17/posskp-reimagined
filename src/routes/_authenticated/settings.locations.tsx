import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";

export const Route = createFileRoute("/_authenticated/settings/locations")({
  component: () => (
    <MasterDataTable
      table="business_locations"
      title="Business Locations"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "location_id", label: "Location ID", placeholder: "BL0001" },
        { key: "landmark", label: "Landmark" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "country", label: "Country" },
        { key: "zip_code", label: "Zip code" },
        { key: "mobile", label: "Mobile" },
        { key: "email", label: "Email" },
      ]}
      listColumns={[
        { key: "name", label: "Name" },
        { key: "location_id", label: "ID" },
        { key: "city", label: "City" },
        { key: "mobile", label: "Mobile" },
      ]}
    />
  ),
});
