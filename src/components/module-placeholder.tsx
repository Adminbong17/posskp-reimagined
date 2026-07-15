import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Coming in the next build
        </div>
        <ul className="space-y-2 text-sm">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <p className="pt-3 text-xs text-muted-foreground">
          এই মডিউলটি এখন সাইডবারে সক্রিয় — শীঘ্রই এখানে সম্পূর্ণ ফিচার যোগ হবে।
        </p>
      </div>
    </div>
  );
}
