// Client-side helpers for FileVault attachments.
export const VAULT_BASE = "https://api.bongbangla.top/vault-api";

/** Public download/preview URL for a file (uses share_token — no auth). */
export function vaultShareUrl(shareToken: string) {
  return `${VAULT_BASE}/share.php?t=${shareToken}`;
}
