/**
 * incentive/types.ts – reine Typen (kein Server-Import), nutzbar in Client & Server.
 * Datenmodell für den Incentive Builder (KI-Reiseplaner).
 */

export interface DateRange { start: string; end: string }

export interface IncentiveBrief {
  groupSize: number;
  days: number;
  periods: DateRange[];          // mögliche Reisezeiträume (mind. 1)
  exclusions: DateRange[];       // auszuschließende Zeiträume (optional)
  departureRegion: string;       // z.B. "Zürich, Schweiz"
  budgetLevel: 'standard' | 'premium' | 'luxus';
  styles: string[];             // Teambuilding, Adventure, Kulinarik, Strand, Stadt, Wellness, Kultur, Action …
  notes?: string;
}

export interface WeatherInfo {
  score: number;                 // 0-100 (höher = besser)
  tempMaxAvg: number;            // Ø Tageshöchsttemperatur (°C)
  precipMm: number;              // Niederschlag im Zeitraum (mm)
  summary: string;               // kurzer Klartext
  basis: string;                 // Datengrundlage (z.B. "Vorjahr, gleicher Zeitraum")
}

export interface DestinationOption {
  name: string;
  country: string;
  region?: string;
  lat: number;
  lon: number;
  rationale: string;             // warum passt das Ziel
  weather?: WeatherInfo;
  imageUrl?: string;
  imageCredit?: string;
}

export interface PlannedActivity {
  name: string;
  description: string;
  durationH?: number;
  bookingHint?: string;          // z.B. "buchbar über GetYourGuide" (Platzhalter bis API)
}

export interface DayPlan {
  day: number;
  title: string;
  theme: string;
  morning: string;
  afternoon: string;
  evening: string;
  activities: PlannedActivity[];
  transport?: string;
  accommodation?: string;
  wow?: string;                  // WOW-Moment des Tages
  text: string;                  // emotionaler Tagestext (Präsentation)
  imageUrl?: string;
  imageCredit?: string;
}

export interface Feasibility {
  ok: boolean;
  score: number;                 // 0-100
  issues: string[];
  notes: string;
}

export interface IncentivePlan {
  destination: DestinationOption;
  rankedAlternatives: DestinationOption[]; // weitere Ziele (nach Wetter sortiert)
  chosenPeriod: DateRange;
  introTitle: string;
  introText: string;             // emotionales Intro
  summary: string;
  days: DayPlan[];
  accommodation: { name: string; description: string; bookingHint?: string };
  logistics: string;             // Anreise / Transfers
  wowHighlights: string[];
  estBudgetPerPerson?: string;
  feasibility: Feasibility;
}

export interface IncentivePlanRecord {
  id: string;
  created_at: string;
  title: string;
  status: string;                // 'generating' | 'final' | 'error' | 'draft'
  brief: IncentiveBrief;
  plan: IncentivePlan | null;
  error?: string;
}

export const STYLE_OPTIONS = [
  'Teambuilding', 'Adventure / Action', 'Kulinarik', 'Strand & Meer', 'Stadt & Kultur',
  'Wellness & Entspannung', 'Natur & Outdoor', 'Luxus & Exklusiv', 'Sport-Event', 'Winter / Schnee',
];

export const BUDGET_LABELS: Record<IncentiveBrief['budgetLevel'], string> = {
  standard: 'Standard', premium: 'Premium', luxus: 'Luxus',
};
