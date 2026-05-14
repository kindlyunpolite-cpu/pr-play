import { cn } from "@/lib/utils";
import type { CardSize } from "./types";

const SIZE_CLASSES: Record<CardSize, string> = {
  xs: "w-7 h-10 rounded-[5px]",
  sm: "w-12 h-[4.5rem] rounded-[10px]",
  md: "w-[4.25rem] h-[6.2rem] rounded-2xl",
  lg: "w-[5.25rem] h-[7.7rem] rounded-2xl",
  xl: "w-[6.5rem] h-[9.5rem] rounded-[22px]",
};

export interface HiddenCardProps {
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}

/** Face-down card — used for opponents and the deck. */
export function HiddenCard({ size = "md", className, style }: HiddenCardProps) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn("card-back shrink-0 transition-transform", SIZE_CLASSES[size], className)}
    />
  );
}
