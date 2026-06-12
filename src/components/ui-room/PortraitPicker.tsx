import { cn } from "@/lib/utils";
import { PORTRAITS } from "@/lib/portraits";
import { SeatPortrait } from "./SeatPortrait";
import { Check } from "lucide-react";

interface PortraitPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function PortraitPicker({ value, onChange }: PortraitPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PORTRAITS.map((p) => {
        const selected = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={selected}
            aria-label={p.name}
            className={cn(
              "group relative flex flex-col items-center gap-1 rounded-xl border p-1.5 transition active:scale-95",
              selected
                ? "border-[color:var(--gold)]/70 bg-[color:var(--gold)]/8 shadow-[0_0_18px_-6px_oklch(0.82_0.14_85/0.6)]"
                : "border-white/8 bg-black/30 hover:border-[color:var(--gold)]/35",
            )}
          >
            <div className="flex h-16 w-full items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-transparent to-black/40">
              <SeatPortrait
                src={p.src}
                name={p.name}
                accent={p.accent}
                size="sm"
                active={selected}
              />
            </div>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                selected ? "text-[color:var(--gold)]" : "text-muted-foreground",
              )}
            >
              {p.name}
            </span>
            {selected && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--primary-foreground)] shadow-md">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
