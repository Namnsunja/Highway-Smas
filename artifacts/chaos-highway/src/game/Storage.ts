// localStorage save/load for high score, scrap, and upgrades
const KEY = "chs3d_save_v1";

export interface Upgrades {
  bumper: number; // 0..5 - extra health & smash damage
  engine: number; // 0..5 - faster top speed & nitro power
  nitroTank: number; // 0..5 - more nitro capacity
  explosive: number; // 0..5 - bigger explosion radius / chain bonus
  paint: number; // 0..7 - cosmetic color index
  car: number; // 0..3 - chassis tier (sedan, truck, monster, tank)
}

export interface SaveData {
  highScore: number;
  totalScrap: number;
  lastDistance: number;
  upgrades: Upgrades;
  muted: boolean;
}

const defaultSave: SaveData = {
  highScore: 0,
  totalScrap: 0,
  lastDistance: 0,
  upgrades: { bumper: 0, engine: 0, nitroTank: 0, explosive: 0, paint: 0, car: 0 },
  muted: false,
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

// Fake-but-stable global leaderboard (motivational, mixed with real high score)
const NAMES = [
  "K1NG_W3CK",
  "NeonRipper",
  "JunkLord",
  "SmashGod_99",
  "ChaosKitten",
  "BumperBaron",
  "TurboMoth",
  "NitroNyx",
  "RoadRogue",
  "MegaCrash",
  "PixelPyre",
  "SkidQueen",
];

export function getFakeLeaderboard(playerScore: number): { name: string; score: number }[] {
  // deterministic-ish list around a high baseline
  const base = [
    { name: NAMES[0], score: 1_842_330 },
    { name: NAMES[1], score: 1_421_900 },
    { name: NAMES[2], score: 1_188_450 },
    { name: NAMES[3], score: 989_720 },
    { name: NAMES[4], score: 812_010 },
    { name: NAMES[5], score: 645_500 },
    { name: NAMES[6], score: 512_880 },
    { name: NAMES[7], score: 410_300 },
    { name: NAMES[8], score: 332_140 },
    { name: NAMES[9], score: 267_900 },
  ];
  if (playerScore > 0) {
    const list = [...base, { name: "YOU", score: playerScore }];
    list.sort((a, b) => b.score - a.score);
    return list.slice(0, 10);
  }
  return base;
}
