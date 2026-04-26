// localStorage save/load for high score, scrap, upgrades, and player leaderboard.
const KEY = "chs3d_save_v1";

export interface Upgrades {
  bumper: number;
  engine: number;
  nitroTank: number;
  explosive: number;
  paint: number;
  car: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  distance: number;
  level: number;
  ts: number;
}

export interface SaveData {
  highScore: number;
  totalScrap: number;
  lastDistance: number;
  upgrades: Upgrades;
  muted: boolean;
  playerEntries: LeaderboardEntry[];
  lastPlayerName: string;
}

const defaultSave: SaveData = {
  highScore: 0,
  totalScrap: 0,
  lastDistance: 0,
  upgrades: { bumper: 0, engine: 0, nitroTank: 0, explosive: 0, paint: 0, car: 0 },
  muted: false,
  playerEntries: [],
  lastPlayerName: "",
};

export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...defaultSave };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...defaultSave };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...defaultSave,
      ...parsed,
      upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades ?? {}) },
      playerEntries: Array.isArray(parsed.playerEntries) ? parsed.playerEntries.slice(0, 50) : [],
      lastPlayerName: typeof parsed.lastPlayerName === "string" ? parsed.lastPlayerName : "",
    };
  } catch {
    return { ...defaultSave };
  }
}

export function writeSave(data: SaveData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function addPlayerEntry(
  data: SaveData,
  entry: Omit<LeaderboardEntry, "ts">,
): SaveData {
  const newEntry: LeaderboardEntry = { ...entry, ts: Date.now() };
  const merged = [...data.playerEntries, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  return { ...data, playerEntries: merged, lastPlayerName: entry.name };
}

// ============================================================================
// Mixed leaderboard: real player runs blended with motivational fake entries.
// ============================================================================
const FAKE_NAMES = [
  "K1NG_W3CK", "NeonRipper", "JunkLord", "SmashGod_99", "ChaosKitten",
  "BumperBaron", "TurboMoth", "NitroNyx", "RoadRogue", "MegaCrash",
  "PixelPyre", "SkidQueen", "Voltride", "DemoDuke", "RustWraith",
];

const FAKE_BASE: { name: string; score: number; distance: number; level: number }[] = [
  { name: FAKE_NAMES[0]!, score: 1_842_330, distance: 18_420, level: 9 },
  { name: FAKE_NAMES[1]!, score: 1_421_900, distance: 15_210, level: 8 },
  { name: FAKE_NAMES[2]!, score: 1_188_450, distance: 13_140, level: 7 },
  { name: FAKE_NAMES[3]!, score: 989_720, distance: 11_980, level: 7 },
  { name: FAKE_NAMES[4]!, score: 812_010, distance: 10_240, level: 6 },
  { name: FAKE_NAMES[5]!, score: 645_500, distance: 8_810, level: 5 },
  { name: FAKE_NAMES[6]!, score: 512_880, distance: 7_640, level: 5 },
  { name: FAKE_NAMES[7]!, score: 410_300, distance: 6_220, level: 4 },
  { name: FAKE_NAMES[8]!, score: 332_140, distance: 5_330, level: 4 },
  { name: FAKE_NAMES[9]!, score: 267_900, distance: 4_410, level: 3 },
  { name: FAKE_NAMES[10]!, score: 218_640, distance: 3_980, level: 3 },
  { name: FAKE_NAMES[11]!, score: 174_200, distance: 3_240, level: 3 },
  { name: FAKE_NAMES[12]!, score: 138_770, distance: 2_710, level: 2 },
  { name: FAKE_NAMES[13]!, score: 98_410, distance: 2_180, level: 2 },
  { name: FAKE_NAMES[14]!, score: 64_300, distance: 1_540, level: 1 },
];

export interface MixedRow extends LeaderboardEntry {
  isPlayer: boolean;
  rank: number;
}

export function getMixedLeaderboard(playerEntries: LeaderboardEntry[]): MixedRow[] {
  const fakeEntries: LeaderboardEntry[] = FAKE_BASE.map((f) => ({ ...f, ts: 0 }));
  const playerMarked = playerEntries.map((p) => ({ entry: p, isPlayer: true }));
  const fakeMarked = fakeEntries.map((p) => ({ entry: p, isPlayer: false }));
  const all = [...playerMarked, ...fakeMarked]
    .sort((a, b) => b.entry.score - a.entry.score)
    .slice(0, 12)
    .map((row, i): MixedRow => ({ ...row.entry, isPlayer: row.isPlayer, rank: i + 1 }));
  return all;
}

export function qualifiesForLeaderboard(score: number, playerEntries: LeaderboardEntry[]): boolean {
  if (score <= 0) return false;
  if (playerEntries.length < 10) return true;
  const lowestTop10 = playerEntries.slice(0, 10).reduce((min, e) => Math.min(min, e.score), Infinity);
  return score > lowestTop10;
}
