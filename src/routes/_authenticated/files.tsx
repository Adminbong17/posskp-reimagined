import { createFileRoute } from "@tanstack/react-router";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({ meta: [{ title: "Files — QweekPOS" }] }),
  component: FilesPage,
});

function FilesPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Files</h1>
        <p className="text-sm text-muted-foreground">
          Business files stored securely in FileVault. Upload any file — images, PDFs, CSVs, backups.
        </p>
      </div>
      <AttachmentsPanel entityType="business" title="Business files" />
    </div>
  );
}
