import type { FecalScore, PoopColor } from "@/lib/types";

/**
 * Purina Fecal Scoring Chart, 1-7. The veterinary standard for dog stool
 * consistency; 2-3 is the ideal band.
 *
 * `label` and `description` are the chart's own wording and are not ours to
 * improve: they are what a vet reads off the CSV export. `nickname` is the
 * vernacular translation shown alongside them in the grader, which is.
 */
export type ScoreInfo = {
  score: FecalScore;
  label: string;
  nickname: string;
  description: string;
  ideal: boolean;
  /** Pill classes for the history badge. */
  badge: string;
  /** Chart dot fill. */
  dot: string;
};

/**
 * Severity reads outward from the ideal band in both directions - a 1 is a
 * problem for the opposite reason a 7 is - so the ramp diverges from 2-3
 * rather than running cold-to-hot across the whole scale.
 */
export const PURINA_SCALE: readonly ScoreInfo[] = [
  {
    score: 1,
    label: "Hard pellets",
    nickname: "Rabbit impersonation",
    description:
      "Very hard and dry; takes much effort to pass, often as separate pellets. Leaves no residue.",
    ideal: false,
    badge: "bg-amber-600/15 text-amber-800 dark:text-amber-300",
    dot: "fill-amber-600",
  },
  {
    score: 2,
    label: "Firm, segmented",
    nickname: "Chef's kiss",
    description: "Firm but not hard, pliable, segmented. Little or no residue when picked up.",
    ideal: true,
    badge: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300",
    dot: "fill-emerald-600",
  },
  {
    score: 3,
    label: "Log-like, moist",
    nickname: "The namesake",
    description:
      "Log-like with little segmentation and a moist surface. Leaves residue but holds its form.",
    ideal: true,
    badge: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300",
    dot: "fill-emerald-600",
  },
  {
    score: 4,
    label: "Soggy log",
    nickname: "Structural concerns",
    description:
      "Very moist but still a distinct log. Leaves residue and loses its form when picked up.",
    ideal: false,
    badge: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
    dot: "fill-amber-500",
  },
  {
    score: 5,
    label: "Moist pile",
    nickname: "Freeform",
    description:
      "Very moist with some shape, in piles rather than logs. Loses its form when picked up.",
    ideal: false,
    badge: "bg-orange-500/20 text-orange-800 dark:text-orange-300",
    dot: "fill-orange-500",
  },
  {
    score: 6,
    label: "Shapeless mush",
    nickname: "Abstract expressionism",
    description: "Has texture but no defined shape; occurs as piles or spots. Leaves residue.",
    ideal: false,
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
    dot: "fill-red-500",
  },
  {
    score: 7,
    label: "Watery puddle",
    nickname: "Code brown",
    description: "Watery, no texture, flat. Occurs as puddles.",
    ideal: false,
    badge: "bg-red-600/20 text-red-700 dark:text-red-300",
    dot: "fill-red-600",
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
 *
 * Each swatch is lit from the upper left so it reads as a solid object rather
 * than a paint chip; `.swatch` in styles.css lays a grain over the top. The
 * red one keeps its diagonal streak underneath that lighting, because the
 * streak is the diagnostic feature and must stay unmistakable.
 */
export const COLOR_INFO: Record<PoopColor, { label: string; swatch: string; concerning: boolean }> =
  {
    brown: {
      label: "Brown",
      swatch: "radial-gradient(circle at 32% 26%, #a5713f 0%, #7b4b26 52%, #52301a 100%)",
      concerning: false,
    },
    dark: {
      label: "Dark brown",
      swatch: "radial-gradient(circle at 32% 26%, #62402a 0%, #3e2413 55%, #24140a 100%)",
      concerning: false,
    },
    black: {
      label: "Black / tarry",
      swatch: "radial-gradient(circle at 32% 26%, #3a2f27 0%, #17110d 55%, #0a0705 100%)",
      concerning: true,
    },
    red: {
      label: "Red streaks",
      swatch: [
        "radial-gradient(circle at 32% 26%, rgb(255 255 255 / 28%) 0%, rgb(255 255 255 / 0%) 55%)",
        "linear-gradient(135deg,#7b4b26 0%,#7b4b26 40%,#a3231b 50%,#7b4b26 60%,#7b4b26 100%)",
      ].join(","),
      concerning: true,
    },
    yellow: {
      label: "Yellow",
      swatch: "radial-gradient(circle at 32% 26%, #e6c05c 0%, #c79a2e 52%, #96701a 100%)",
      concerning: true,
    },
    green: {
      label: "Green",
      swatch: "radial-gradient(circle at 32% 26%, #74a355 0%, #4e7a38 52%, #35521f 100%)",
      concerning: true,
    },
    grey: {
      label: "Grey",
      swatch: "radial-gradient(circle at 32% 26%, #c0b8ae 0%, #9a9188 52%, #6f675f 100%)",
      concerning: true,
    },
  };

export const FLAG_LABELS = {
  blood: "Blood",
  mucus: "Mucus",
  worms: "Worms",
} as const;
