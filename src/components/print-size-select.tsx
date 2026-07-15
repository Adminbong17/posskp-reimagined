import { useState } from "react";
import { Printer } from "lucide-react";

export type PrintSize = "A4" | "80mm" | "58mm";

/**
 * Compact print control: paper-size dropdown + Print button.
 * The `onPrint` callback receives the selected size.
 */
export function PrintSizeButton({
  onPrint,
  label = "Print",
  defaultSize = "A4",
  className = "",
}: {
  onPrint: (size: PrintSize) => void;
  label?: string;
  defaultSize?: PrintSize;
  className?: string;
}) {
  const [size, setSize] = useState<PrintSize>(defaultSize);
  return (
    <div className={`inline-flex items-stretch overflow-hidden rounded-md border border-border/60 ${className}`}>
      <select
        value={size}
        onChange={(e) => setSize(e.target.value as PrintSize)}
        className="h-8 bg-input px-2 text-xs border-r border-border/60 focus:outline-none"
        title="Paper size"
      >
        <option value="A4">A4</option>
        <option value="80mm">80mm</option>
        <option value="58mm">58mm</option>
      </select>
      <button
        type="button"
        onClick={() => onPrint(size)}
        className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs hover:bg-muted"
      >
        <Printer className="h-3.5 w-3.5" /> {label}
      </button>
    </div>
  );
}