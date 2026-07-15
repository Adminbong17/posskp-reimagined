import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — QweekPOS" }] }),
  component: ProductsLayout,
});

const tabs: { to: string; label: string; exact?: boolean }[] = [
  { to: "/products", label: "All Products", exact: true },
  { to: "/products/new", label: "Add Product" },
  { to: "/products/stock-adjustments", label: "Stock Adjustments" },
];

function ProductsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Products</h1>
        <p className="text-sm text-muted-foreground">Manage your product catalog, variations and stock.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border/60">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
          return (
          <Link key={t.to} to={t.to as any}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
