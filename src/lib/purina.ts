import type { FecalScore, PoopColor } from "@/lib/types";

/**
 * Purina Fecal Scoring Chart, 1-7. The veterinary standard for dog stool
 * consistency; 2-3 is the ideal band.
 */
export type ScoreInfo = {
  score: FecalScore;
  label: string;
  description: string;
  ideal: boolean;
};

export const PURINA_SCALE: readonly ScoreInfo[] = [
  {
    score: 1,
    label: "Hard pellets",
    description:
      "Very hard and dry; takes much effort to pass, often as separate pellets. Leaves no residue.",
    ideal: false,
  },
  {
    score: 2,
    label: "Firm, segmented",
    description: "Firm but not hard, pliable, segmented. Little or no residue when picked up.",
    ideal: true,
  },
  {
    score: 3,
    label: "Log-like, moist",
    description:
      "Log-like with little segmentation and a moist surface. Leaves residue but holds its form.",
    ideal: true,
  },
  {
    score: 4,
    label: "Soggy log",
    description:
      "Very moist but still a distinct log. Leaves residue and loses its form when picked up.",
    ideal: false,
  },
  {
    score: 5,
    label: "Moist pile",
    description:
      "Very moist with some shape, in piles rather than logs. Loses its form when picked up.",
    ideal: false,
  },
  {
    score: 6,
    label: "Shapeless mush",
    description: "Has texture but no defined shape; occurs as piles or spots. Leaves residue.",
    ideal: false,
  },
  {
    score: 7,
    label: "Watery puddle",
    description: "Watery, no texture, flat. Occurs as puddles.",
    ideal: false,
  },
];

export const IDEAL_MIN = 2;
export const IDEAL_MAX = 3;

export function scoreInfo(score: FecalScore): ScoreInfo {
  return PURINA_SCALE[score - 1];
}

/**
 * Literal colors, not theme tokens: these are the actual thing being judged,
 * so they must render identically in light and dark mode.
 */
export const COLOR_INFO: Record<PoopColor, { label: string; swatch: string; concerning: boolean }> =
  {
    brown: { label: "Brown", swatch: "#7b4b26", concerning: false },
    dark: { label: "Dark brown", swatch: "#3e2413", concerning: false },
    black: { label: "Black / tarry", swatch: "#17110d", concerning: true },
    red: {
      label: "Red streaks",
      swatch: "linear-gradient(135deg,#7b4b26 0%,#7b4b26 40%,#a3231b 50%,#7b4b26 60%,#7b4b26 100%)",
      concerning: true,
    },
    yellow: { label: "Yellow", swatch: "#c79a2e", concerning: true },
    green: { label: "Green", swatch: "#4e7a38", concerning: true },
    grey: { label: "Grey", swatch: "#9a9188", concerning: true },
  };

export const FLAG_LABELS = {
  blood: "Blood",
  mucus: "Mucus",
  worms: "Worms",
} as const;
