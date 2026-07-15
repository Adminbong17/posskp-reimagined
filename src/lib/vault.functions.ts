// Server functions that proxy to FileVault (https://api.bongbangla.top/vault-api).
// The VAULT_TOKEN never leaves the server. All calls are gated by requireSupabaseAuth
// and scoped to a business the caller is a member of.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VAULT_BASE = "https://api.bongbangla.top/vault-api";

function vaultToken(): string {
  const t = process.env.VAULT_TOKEN;
  if (!t) throw new Error("VAULT_TOKEN is not configured on the server");
  return t;
}

type VaultFile = {
  id: number;
  original_name: string;
  size: number;
  mime: string;
  share_token: string;
  folder_id: number | null;
  created_at: string;
};

async function assertMember(
  supabase: any,
  userId: string,
  businessId: string,
) {
  const { data, error } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Not a member of this business");
}

// Upload a file. Client sends FormData: file, business_id, entity_type, entity_id?
export const vaultUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("FormData required");
    const file = data.get("file");
    const business_id = String(data.get("business_id") ?? "");
    const entity_type = String(data.get("entity_type") ?? "misc");
    const entity_id = data.get("entity_id") ? String(data.get("entity_id")) : null;
    if (!(file instanceof File)) throw new Error("file is required");
    if (!business_id) throw new Error("business_id is required");
    return { file, business_id, entity_type, entity_id };
  })
  .handler(async ({ data, context }) => {
    const { file, business_id, entity_type, entity_id } = data;
    await assertMember(context.supabase, context.userId, business_id);

    const fd = new FormData();
    fd.append("file", file, file.name);

    const res = await fetch(`${VAULT_BASE}/upload.php`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vaultToken()}` },
      body: fd,
    });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`Vault upload failed [${res.status}]: ${bodyText}`);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      throw new Error(`Vault returned non-JSON response: ${bodyText.slice(0, 200)}`);
    }
    // API may return { file: {...} }, { data: {...} }, or the file object directly
    const vf: any = parsed?.file ?? parsed?.data ?? parsed;
    const vaultId = vf?.id ?? vf?.file_id ?? vf?.fileId;
    if (!vf || vaultId == null) {
      throw new Error(`Vault upload: unexpected response ${bodyText.slice(0, 200)}`);
    }
    const fileName =
      vf.original_name ?? vf.originalName ?? vf.name ?? vf.filename ?? file.name;
    const mime = vf.mime ?? vf.mime_type ?? vf.mimeType ?? file.type ?? "application/octet-stream";
    const size = vf.size ?? vf.file_size ?? file.size ?? 0;
    const shareToken = vf.share_token ?? vf.shareToken ?? vf.token ?? null;
    const folderId = vf.folder_id ?? vf.folderId ?? null;

    const { data: row, error } = await context.supabase
      .from("attachments")
      .insert({
        business_id,
        entity_type,
        entity_id,
        vault_file_id: vaultId,
        share_token: shareToken,
        file_name: fileName,
        mime,
        size,
        folder_id: folderId,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const vaultDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attachment_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: att, error: e1 } = await context.supabase
      .from("attachments")
      .select("id, vault_file_id, business_id")
      .eq("id", data.attachment_id)
      .maybeSingle();
    if (e1) throw e1;
    if (!att) throw new Error("Attachment not found");
    await assertMember(context.supabase, context.userId, att.business_id);

    if (att.vault_file_id) {
      const fid = String(att.vault_file_id);
      const form = new URLSearchParams({ id: fid, file_id: fid, fileId: fid });
      const res = await fetch(`${VAULT_BASE}/delete.php?id=${encodeURIComponent(fid)}&file_id=${encodeURIComponent(fid)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vaultToken()}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!res.ok && res.status !== 404) {
        const t = await res.text();
        // Tolerate "Missing id" so the DB row is still removed even if the vault API shape differs
        if (!/missing id/i.test(t)) {
          throw new Error(`Vault delete failed [${res.status}]: ${t}`);
        }
      }
    }
    const { error: e2 } = await context.supabase
      .from("attachments")
      .delete()
      .eq("id", data.attachment_id);
    if (e2) throw e2;
    return { ok: true };
  });

// Rename in vault + attachments row
export const vaultRename = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attachment_id: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: att, error } = await context.supabase
      .from("attachments")
      .select("id, vault_file_id, business_id")
      .eq("id", data.attachment_id)
      .maybeSingle();
    if (error) throw error;
    if (!att) throw new Error("Attachment not found");
    await assertMember(context.supabase, context.userId, att.business_id);

    const res = await fetch(`${VAULT_BASE}/rename.php`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vaultToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: att.vault_file_id, name: data.name }),
    });
    if (!res.ok) {
      throw new Error(`Vault rename failed [${res.status}]: ${await res.text()}`);
    }
    await context.supabase
      .from("attachments")
      .update({ file_name: data.name })
      .eq("id", data.attachment_id);
    return { ok: true };
  });
