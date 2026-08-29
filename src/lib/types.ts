export const FECAL_SCORES = [1, 2, 3, 4, 5, 6, 7] as const;
export type FecalScore = (typeof FECAL_SCORES)[number];

export const POOP_COLORS = [
  "brown",
  "dark",
  "black",
  "red",
  "yellow",
  "green",
  "grey",
] as const;
export type PoopColor = (typeof POOP_COLORS)[number];

export const POOP_FLAGS = ["blood", "mucus", "worms"] as const;
export type PoopFlag = (typeof POOP_FLAGS)[number];

export type Dog = {
  id: string;
  name: string;
  /** ISO 8601 */
  createdAt: string;
};

export type PoopLog = {
  id: string;
  dogId: string;
  score: FecalScore;
  color: PoopColor | null;
  flags: PoopFlag[];
  /** ISO 8601 */
  loggedAt: string;
};

export type Store = {
  version: 1;
  dogs: Dog[];
  logs: PoopLog[];
};

export const EMPTY_STORE: Store = { version: 1, dogs: [], logs: [] };
