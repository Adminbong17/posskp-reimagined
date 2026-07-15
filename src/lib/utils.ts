import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/** Format any date-ish value as dd/mm/yyyy. Accepts ISO string, YYYY-MM-DD, or Date. */
export function formatDate(d: string | number | Date | null | undefined): string {
  if (!d) return "";
  // Handle plain YYYY-MM-DD without timezone shift
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

/** Format date + time as dd/mm/yyyy HH:mm. */
export function formatDateTime(d: string | number | Date | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${formatDate(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

