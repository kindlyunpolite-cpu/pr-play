import portraitPavla from "@/assets/portraits/pavla.png";
import portraitTomas from "@/assets/portraits/tomas.png";
import portraitEva from "@/assets/portraits/eva.png";
import portraitYou from "@/assets/portraits/you.png";
import portraitLenka from "@/assets/portraits/lenka.png";
import portraitHonza from "@/assets/portraits/honza.png";

export interface Portrait {
  id: string;
  name: string;
  src: string;
  /** Rim-light accent color used on seats. */
  accent: string;
}

export const PORTRAITS: Portrait[] = [
  { id: "karel", name: "Karel", src: portraitYou, accent: "oklch(0.72 0.2 290)" },
  { id: "pavla", name: "Pavla", src: portraitPavla, accent: "oklch(0.7 0.18 25)" },
  { id: "tomas", name: "Tomáš", src: portraitTomas, accent: "oklch(0.78 0.16 60)" },
  { id: "eva", name: "Eva", src: portraitEva, accent: "oklch(0.68 0.22 320)" },
  { id: "lenka", name: "Lenka", src: portraitLenka, accent: "oklch(0.82 0.14 85)" },
  { id: "honza", name: "Honza", src: portraitHonza, accent: "oklch(0.65 0.15 200)" },
];

const BY_ID = new Map(PORTRAITS.map((p) => [p.id, p]));

export function getPortrait(id: string | null | undefined): Portrait {
  if (id && BY_ID.has(id)) return BY_ID.get(id)!;
  return PORTRAITS[0];
}
