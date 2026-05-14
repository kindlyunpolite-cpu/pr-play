import { cn } from "@/lib/utils";
import { SuitIcon } from "./SuitIcon";
import { isRedSuit, SUIT_LABEL, type Suit } from "./types";

export interface SuitBadgeProps {
  suit: Suit;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function SuitBadge({ suit, size = "md", showLabel = false, className }: SuitBadgeProps) {
  const red = isRedSuit(suit);
  const dim =
    size === "sm" ? "h-7 w-7" : size === "md" ? "h-10 w-10" : "h-14 w-14";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "md" ? "h-5 w-5" : "h-7 w-7";

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-[color:var(--card-face)] shadow-md",
          dim,
          red ? "text-[color:var(--suit-red)]" : "text-[color:var(--suit-dark)]",
        )}
      >
        <SuitIcon suit={suit} className={icon} />
      </div>
      {showLabel && (
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {SUIT_LABEL[suit]}
        </span>
      )}
    </div>
  );
}
