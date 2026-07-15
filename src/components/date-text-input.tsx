import { useEffect, useState } from "react";

// Accepts plain 8-digit DDMMYYYY input (e.g. 11062026). Stores ISO YYYY-MM-DD.
function isoToDdmmyyyy(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}${m[2]}${m[1]}`;
}

function ddmmyyyyToIso(s: string): string {
  const m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function DateTextInput({
  value,
  onChange,
  className,
  placeholder = "ddmmyyyy",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(isoToDdmmyyyy(value));

  useEffect(() => {
    const external = isoToDdmmyyyy(value);
    if (external !== text && ddmmyyyyToIso(text) !== value) {
      setText(external);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={8}
      className={className}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
        setText(digits);
        onChange(ddmmyyyyToIso(digits));
      }}
      onBlur={() => {
        if (text && !ddmmyyyyToIso(text)) {
          setText("");
          onChange("");
        }
      }}
    />
  );
}

