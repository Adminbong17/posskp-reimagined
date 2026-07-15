import { createFileRoute } from "@tanstack/react-router";
import { MasterDataTable } from "@/components/master-data-table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { printHrmReport } from "@/lib/hrm-print";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hrm/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data: business } = useCurrentBusiness();
  const { data: employees = [] } = useQuery({
    queryKey: ["hrm_employees_print", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("hrm_employees").select("*")
        .eq("business_id", business!.id).order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => printHrmReport({
          title: "Employee Directory",
          business,
          columns: [
            { label: "Name" }, { label: "Designation" }, { label: "Department" },
            { label: "Phone" }, { label: "Joining" },
            { label: "Salary", align: "right" }, { label: "Status" },
          ],
          rows: employees.map((e: any) => [
            e.name, e.designation ?? "—", e.department ?? "—", e.phone ?? "—",
            e.joining_date ? new Date(e.joining_date).toLocaleDateString("en-GB") : "—",
            `৳ ${Number(e.salary || 0).toLocaleString()}`,
            e.is_active ? "Active" : "Inactive",
          ]),
          filename: "employees",
        })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>
      <MasterDataTable
        table="hrm_employees"
        title="Employees"
        fields={[
          { key: "name", label: "Full name", required: true },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "designation", label: "Designation" },
          { key: "department", label: "Department" },
          { key: "joining_date", label: "Joining date", type: "date" },
          { key: "salary", label: "Monthly salary", type: "number", defaultValue: 0 },
          { key: "address", label: "Address", type: "textarea" },
          { key: "is_active", label: "Active", type: "checkbox", defaultValue: true },
        ]}
        listColumns={[
          { key: "name", label: "Name" },
          { key: "designation", label: "Designation" },
          { key: "department", label: "Dept" },
          { key: "phone", label: "Phone" },
          { key: "salary", label: "Salary", render: (r) => `৳ ${Number(r.salary || 0).toLocaleString()}` },
          { key: "is_active", label: "Status", render: (r) => r.is_active ? "Active" : "Inactive" },
        ]}
      />
    </div>
  );
}
