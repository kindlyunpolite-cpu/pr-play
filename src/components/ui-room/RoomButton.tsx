import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface RoomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  block?: boolean;
}

const sizeCls: Record<Size, string> = {
  sm: "h-9 px-3 text-[11px]",
  md: "h-11 px-5 text-xs",
  lg: "h-12 px-6 text-sm",
};

/**
 * Unified card-room button. Used for Lízni, Zahraj, Připraven, Spustit hru,
 * Kopírovat odkaz — anywhere the user takes an action.
 */
export const RoomButton = forwardRef<HTMLButtonElement, RoomButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      icon,
      iconRight,
      block = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const base =
      "relative inline-flex items-center justify-center gap-2 rounded-full font-bold uppercase tracking-[0.16em] transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed select-none";

    const variantCls =
      variant === "primary"
        ? "text-[color:var(--primary-foreground)] ring-1 ring-[color:var(--gold)]/60 shadow-[0_10px_28px_-10px_oklch(0.82_0.14_85/0.6),inset_0_1px_0_oklch(1_0_0/0.35)] hover:brightness-110"
        : variant === "ghost"
          ? "text-foreground/80 hover:text-[color:var(--gold)] bg-transparent"
          : "control-pill text-foreground/90 hover:border-[color:var(--gold)]/45 hover:text-[color:var(--gold)]";

    return (
      <button
        ref={ref}
        {...props}
        disabled={disabled || loading}
        className={cn(base, sizeCls[size], variantCls, block && "w-full", className)}
        style={
          variant === "primary"
            ? {
                background:
                  "linear-gradient(180deg, oklch(0.92 0.12 88) 0%, oklch(0.78 0.16 80) 50%, oklch(0.6 0.14 75) 100%)",
                ...props.style,
              }
            : props.style
        }
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
        {!loading && iconRight}
      </button>
    );
  },
);
RoomButton.displayName = "RoomButton";
