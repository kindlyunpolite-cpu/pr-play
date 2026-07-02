import type { CSSProperties } from "react";
import type { Suit } from "./types";

interface SuitProps {
  suit: Suit;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Pure-SVG suit glyphs. No external assets.
 * `currentColor` lets parents control the color via Tailwind text-* classes.
 */
export function SuitIcon({ suit, className, style, title }: SuitProps) {
  const props = {
    viewBox: "0 0 32 32",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    style,
    "aria-label": title ?? suit,
    role: "img" as const,
  };

  switch (suit) {
    case "hearts":
      return (
        <svg {...props}>
          <path
            fill="currentColor"
            d="M16 28S3 19.5 3 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 13 3.5C29 19.5 16 28 16 28Z"
          />
        </svg>
      );
    case "diamonds":
      return (
        <svg {...props}>
          <path fill="currentColor" d="M16 2 28 16 16 30 4 16Z" />
        </svg>
      );
    case "spades":
      return (
        <svg {...props}>
          <path
            fill="currentColor"
            d="M16 2c5 6 11 10 11 15a6 6 0 0 1-10 4.5L18 28h-4l1-6.5A6 6 0 0 1 5 17C5 12 11 8 16 2Z"
          />
        </svg>
      );
    case "clubs":
      return (
        <svg {...props}>
          <path
            fill="currentColor"
            d="M16 2a5.5 5.5 0 0 1 4.7 8.4 5.5 5.5 0 1 1-2.8 9.5L19 28h-6l1.1-8.1a5.5 5.5 0 1 1-2.8-9.5A5.5 5.5 0 0 1 16 2Z"
          />
        </svg>
      );
  }
}
