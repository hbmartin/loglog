/**
 * Two registers for the same app.
 *
 * `field` is the default: dry, and funny because it is dry. `lab` is what the
 * hidden toggle on the title switches to - not sillier, but completely
 * humourless, as though the whole thing were a clinical trial. The joke is
 * that nothing about the app changes except how seriously it describes
 * itself.
 *
 * Only user-facing prose lives here. Accessible names, the Purina wording and
 * the CSV headers deliberately do not: a screen reader user should not have to
 * decode a bit, and a vet should not have to decode anything at all.
 */
export type Register = "field" | "lab";

export const REGISTERS = ["field", "lab"] as const;

export function isRegister(value: unknown): value is Register {
  return value === "field" || value === "lab";
}

export type Lexicon = {
  tagline: string;
  taglineDetail: string;
  emptyTitle: string;
  emptyBody: string;
  addSubject: string;
  namePlaceholders: readonly string[];
  saveSubject: string;
  exportAll: string;
  exportOne: string;
  awaitingFirst: string;
  gradeHeading: string;
  gradeHelp: string;
  colorHeading: string;
  flagsHeading: string;
  optional: string;
  logIt: string;
  toasts: readonly string[];
  historyHeading: string;
  historyEmpty: string;
  statLast: string;
  statWeek: string;
  statMean: string;
  statMeanHint: string;
  regularity: string;
  regularityUnit: string;
  regularityUnitOne: string;
  standingsHeading: string;
  standingsHelp: string;
  achievementsHeading: string;
  achievementsHelp: string;
  wrappedLink: string;
  wrappedHeading: string;
  wrappedEmpty: string;
  /** Read off the year's mean score: firm, ideal, soft, loose. */
  wrappedVerdicts: readonly [string, string, string, string];
  reportLink: string;
  reportHeading: string;
  allSubjects: string;
  notFoundTitle: string;
  notFoundBody: string;
  backHome: string;
  chartEmpty: string;
  chartLegend: string;
  idealBand: string;
  subjectSingular: string;
  subjectPlural: string;
};

const FIELD: Lexicon = {
  tagline: "A log of logs.",
  taglineDetail: "Purina fecal scoring, kept on this device.",
  emptyTitle: "No subjects enrolled.",
  emptyBody: "Add a dog. Or a hairless ape. We don't judge — that's what the scale is for.",
  addSubject: "Enroll a subject",
  namePlaceholders: ["Rufus", "Biscuit", "Sir Poops-a-Lot", "you, if you're honest", "Mabel"],
  saveSubject: "Save",
  exportAll: "Export the findings",
  exportOne: "CSV",
  awaitingFirst: "Awaiting first submission",
  gradeHeading: "How was it?",
  gradeHelp: "Purina fecal score. 2–3 is ideal.",
  colorHeading: "Color",
  flagsHeading: "Anything in it?",
  optional: "(optional)",
  logIt: "Enter into the record",
  toasts: [
    "Logged.",
    "Noted.",
    "Filed.",
    "The record grows.",
    "Science.",
    "Duly recorded.",
    "Entered into evidence.",
  ],
  historyHeading: "The record",
  historyEmpty: "The record is empty.",
  statLast: "Since last",
  statWeek: "This week",
  statMean: "GPA",
  statMeanHint: "Mean score over the past seven days. Yes, we're calling it a GPA.",
  regularity: "Regularity",
  regularityUnit: "days",
  regularityUnitOne: "day",
  standingsHeading: "Standings",
  standingsHelp: "Ranked by how close the week stayed to ideal. Nobody tell them.",
  achievementsHeading: "Achievements",
  achievementsHelp: "Unlocked by living with a dog.",
  wrappedLink: "loglog Wrapped",
  wrappedHeading: "loglog Wrapped",
  wrappedEmpty: "Nothing to wrap. Log something first.",
  wrappedVerdicts: [
    "A firm year. Consider water.",
    "Textbook. Genuinely, well done.",
    "A soft year. It happens.",
    "A difficult year for everyone involved.",
  ],
  reportLink: "Printable summary",
  reportHeading: "Clinical summary",
  allSubjects: "All dogs",
  notFoundTitle: "No such dog.",
  notFoundBody: "That page — or that dog — isn't here.",
  backHome: "Back to the pack",
  chartEmpty: "No data. Go outside.",
  chartLegend: "Last 30 days, 7 (loosest) down to 1. The shaded band is the ideal 2–3 range.",
  idealBand: "ideal",
  subjectSingular: "dog",
  subjectPlural: "dogs",
};

const LAB: Lexicon = {
  tagline: "Longitudinal fecal consistency register.",
  taglineDetail: "Purina Fecal Scoring Chart. Records held locally, in perpetuity.",
  emptyTitle: "Cohort empty.",
  emptyBody: "Enroll at least one subject before observations can be recorded.",
  addSubject: "Register subject",
  namePlaceholders: ["Subject 001", "Canine A", "Specimen source", "Participant"],
  saveSubject: "Commit",
  exportAll: "Export dataset (CSV)",
  exportOne: "Dataset",
  awaitingFirst: "No observations recorded",
  gradeHeading: "Consistency assessment",
  gradeHelp: "Purina Fecal Scoring Chart, 1–7. Reference range 2–3.",
  colorHeading: "Chromaticity",
  flagsHeading: "Observed inclusions",
  optional: "(non-mandatory)",
  logIt: "Commit observation",
  toasts: ["Observation committed.", "Record updated.", "Entry persisted to local store."],
  historyHeading: "Case history",
  historyEmpty: "No observations on file.",
  statLast: "Elapsed",
  statWeek: "7-day count",
  statMean: "7-day mean",
  statMeanHint: "Arithmetic mean of scores recorded in the preceding 168 hours.",
  regularity: "Consecutive days",
  regularityUnit: "d",
  regularityUnitOne: "d",
  standingsHeading: "Cohort comparison",
  standingsHelp: "Subjects ordered by mean absolute deviation from the reference midpoint.",
  achievementsHeading: "Milestones",
  achievementsHelp: "Derived from the observation record.",
  wrappedLink: "Annual summary",
  wrappedHeading: "Annual summary",
  wrappedEmpty: "Insufficient observations to summarise.",
  wrappedVerdicts: [
    "Mean below reference range.",
    "Mean within reference range.",
    "Mean above reference range.",
    "Mean substantially above reference range.",
  ],
  reportLink: "Printable summary",
  reportHeading: "Clinical summary",
  allSubjects: "All subjects",
  notFoundTitle: "Subject not found.",
  notFoundBody: "No record matches this identifier.",
  backHome: "Return to cohort",
  chartEmpty: "No observations in window.",
  chartLegend:
    "Preceding 30 days, score 7 (least formed) to 1. Shaded region marks the 2–3 reference range.",
  idealBand: "ref.",
  subjectSingular: "subject",
  subjectPlural: "subjects",
};

export const LEXICONS: Record<Register, Lexicon> = { field: FIELD, lab: LAB };
