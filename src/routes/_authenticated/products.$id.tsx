import { createFileRoute } from "@tanstack/react-router";
import { ProductForm } from "@/components/product-form";

export const Route = createFileRoute("/_authenticated/products/$id")({
  component: ProductEdit,
});

function ProductEdit() {
  const { id } = Route.useParams();
  return <ProductForm productId={id} />;
}
