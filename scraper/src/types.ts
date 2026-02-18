/**
 * 型定義
 */

export interface RaceInfo {
  raceName: string;
  raceNameJa: string;
  grade: string;
  date: string;
  postTime: string;
  racecourse: string;
  racecourseJa: string;
  surface: string;
  distanceMeters: string;
  turnDirection: string;
  raceNumber: string;
  raceId: string;
}

export interface HorseEntry {
  horseName: string;
  horseNameJa: string;
  sex: string;
  age: string;
  trainingCenter: string;
  jockey: string;
  jockeyJa: string;
  weightKg: string;
  gate: string;
  number: string;
  status: string;
  note: string;
  sourceUrl: string;
}

export interface RaceData extends RaceInfo, HorseEntry {
  registrationCount: string;
  fullGate: string;
}

export interface HorseHistory {
  horseNameJa: string;
  sourceUrl: string;
  raceHistories: RaceHistoryEntry[];
}

export interface RaceHistoryEntry {
  date: string;
  racecourse: string;
  raceName: string;
  distance: string;
  surface: string;
  weather: string;
  trackCondition: string;
  frameNumber: string;
  horseNumber: string;
  popularity: string;
  finish: string;
  jockey: string;
  weight: string;
  time: string;
  margin: string;
}

export const RACECOURSE_MAP: Record<string, string> = {
  札幌: "Sapporo",
  函館: "Hakodate",
  福島: "Fukushima",
  新潟: "Niigata",
  東京: "Tokyo",
  中山: "Nakayama",
  中京: "Chukyo",
  京都: "Kyoto",
  阪神: "Hanshin",
  小倉: "Kokura",
};

export const SEX_MAP: Record<string, string> = {
  牡: "M",
  牝: "F",
  セ: "G",
  騸: "G",
};

export const TRAINING_CENTER_MAP: Record<string, string> = {
  美: "Miho",
  栗: "Ritto",
  美浦: "Miho",
  栗東: "Ritto",
};

export const SURFACE_MAP: Record<string, string> = {
  芝: "Turf",
  ダート: "Dirt",
  ダ: "Dirt",
};
