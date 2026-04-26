import { useState } from "react";
import { CAR_TIERS } from "@/game/Game";
import type { Upgrades } from "@/game/Storage";

interface Props {
  scrap: number;
  upgrades: Upgrades;
  onClose: () => void;
  onApply: (newScrap: number, newUpgrades: Upgrades) => void;
}

interface UpgradeDef {
  key: keyof Upgrades;
  label: string;
  color: string;
  desc: string;
  maxLevel: number;
  cost: (level: number) => number;
}

const UPGRADES: UpgradeDef[] = [
  { key: "bumper", label: "Reinforced Bumper", color: "#ff2bd6", desc: "+25 hull, +damage on smash, less self-damage.", maxLevel: 5, cost: (lv) => 80 + lv * 100 },
  { key: "engine", label: "Turbocharged Engine", color: "#00f0ff", desc: "Higher top speed and snappier steering.", maxLevel: 5, cost: (lv) => 120 + lv * 130 },
  { key: "nitroTank", label: "Bigger Nitro Tank", color: "#ffd400", desc: "+35 boost capacity per level.", maxLevel: 5, cost: (lv) => 100 + lv * 110 },
  { key: "explosive", label: "Explosive Bumper", color: "#ff7a00", desc: "Larger explosion radius & chain bonus.", maxLevel: 5, cost: (lv) => 140 + lv * 150 },
];

const PAINT_NAMES = ["Hot Pink", "Cyan", "Yellow", "Crimson", "Toxic Green", "Orange", "Purple", "Chrome"];
const PAINT_COSTS = [0, 80, 80, 100, 120, 120, 150, 250];
const PAINT_HEX = ["#ff2bd6", "#00f0ff", "#ffd400", "#ff4422", "#66ff66", "#ff7a00", "#9b5cff", "#ffffff"];

export function Shop({ scrap, upgrades, onClose, onApply }: Props) {
  const [localScrap, setLocalScrap] = useState(scrap);
  const [localUp, setLocalUp] = useState<Upgrades>(upgrades);

  const buy = (key: keyof Upgrades, cost: number, max: number) => {
    if (localScrap < cost) return;
    if (localUp[key] >= max) return;
    setLocalScrap(localScrap - cost);
    setLocalUp({ ...localUp, [key]: localUp[key] + 1 });
  };

  const buyCar = (idx: number, cost: number) => {
    if (localUp.car >= idx) return; // already owned/equipped or higher
    if (localScrap < cost) return;
    setLocalScrap(localScrap - cost);
    setLocalUp({ ...localUp, car: idx });
  };

  const equipPaint = (idx: number, cost: number) => {
    if (localScrap < cost) return;
    setLocalScrap(localScrap - cost);
    setLocalUp({ ...localUp, paint: idx });
  };

  const close = () => {
    onApply(localScrap, localUp);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-3"
         style={{ background: "rgba(5, 2, 12, 0.85)" }}>
      <div className="panel rounded-xl p-5 w-full max-w-2xl max-h-[92vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="neon-text-yellow text-2xl sm:text-3xl font-black">🔧 GARAGE</h3>
            <div className="text-[10px] uppercase tracking-widest text-white/60">Upgrade your wrecking machine</div>
          </div>
          <div className="hud-pill rounded-md px-3 py-1.5 text-right" style={{ borderColor: "rgba(94, 255, 124, 0.65)", boxShadow: "0 0 8px rgba(94, 255, 124, 0.4)" }}>
            <div className="text-[10px] uppercase text-green-300/80">Scrap</div>
            <div className="text-lg font-black neon-text-green font-mono">{localScrap.toLocaleString()}</div>
          </div>
        </div>

        {/* Cars */}
        <h4 className="text-sm font-black neon-text-cyan tracking-widest mt-1 mb-2">CHASSIS</h4>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {CAR_TIERS.map((c, idx) => {
            const owned = localUp.car >= idx;
            const equipped = localUp.car === idx;
            const canBuy = !owned && localScrap >= c.cost;
            return (
              <div
                key={c.name}
                className="rounded-md p-3 border"
                style={{
                  borderColor: equipped ? "#ffd400" : owned ? "rgba(0, 240, 255, 0.5)" : "rgba(255,255,255,0.15)",
                  background: equipped ? "rgba(255, 212, 0, 0.07)" : "rgba(0,0,0,0.3)",
                  boxShadow: equipped ? "0 0 12px rgba(255,212,0,0.4)" : undefined,
                }}
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-black text-base text-white">{c.name}</div>
                  <div className="text-[10px] uppercase text-white/55">Tier {idx + 1}</div>
                </div>
                <div className="text-xs text-white/65 mt-1 leading-snug">{c.description}</div>
                <div className="flex flex-wrap gap-2 text-[10px] text-white/70 mt-2">
                  <span>HP {c.baseHealth}</span>
                  <span>Smash x{c.baseSmash.toFixed(2)}</span>
                </div>
                <div className="mt-2">
                  {equipped ? (
                    <div className="text-xs neon-text-yellow font-black">EQUIPPED</div>
                  ) : owned ? (
                    <button
                      onClick={() => setLocalUp({ ...localUp, car: idx })}
                      className="neon-btn neon-btn-cyan rounded px-3 py-1 text-xs w-full"
                    >EQUIP</button>
                  ) : (
                    <button
                      onClick={() => buyCar(idx, c.cost)}
                      disabled={!canBuy}
                      className="neon-btn rounded px-3 py-1 text-xs w-full disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      BUY · {c.cost.toLocaleString()} scrap
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upgrades */}
        <h4 className="text-sm font-black neon-text-pink tracking-widest mt-3 mb-2">UPGRADES</h4>
        <div className="space-y-2">
          {UPGRADES.map((u) => {
            const lv = localUp[u.key] as number;
            const max = u.maxLevel;
            const cost = u.cost(lv);
            const maxed = lv >= max;
            const canBuy = !maxed && localScrap >= cost;
            return (
              <div key={u.key} className="rounded-md p-3 border border-white/10 flex items-center gap-3"
                   style={{ background: "rgba(0,0,0,0.3)" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm" style={{ color: u.color }}>{u.label}</div>
                  <div className="text-xs text-white/65 leading-snug">{u.desc}</div>
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: max }).map((_, i) => (
                      <div key={i} className="h-1.5 w-6 rounded"
                           style={{ background: i < lv ? u.color : "rgba(255,255,255,0.12)", boxShadow: i < lv ? `0 0 6px ${u.color}` : undefined }} />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => buy(u.key, cost, max)}
                  disabled={!canBuy}
                  className="neon-btn rounded px-3 py-2 text-xs flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: u.color, boxShadow: `0 0 10px ${u.color}55` }}
                >
                  {maxed ? "MAXED" : `+1 · ${cost}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Paint */}
        <h4 className="text-sm font-black neon-text-yellow tracking-widest mt-4 mb-2">PAINT JOBS</h4>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PAINT_NAMES.map((name, idx) => {
            const equipped = localUp.paint === idx;
            const cost = PAINT_COSTS[idx]!;
            const canBuy = localScrap >= cost;
            return (
              <button
                key={name}
                onClick={() => equipPaint(idx, cost)}
                disabled={!equipped && !canBuy}
                title={`${name} · ${cost} scrap`}
                className="rounded p-1 border-2 hover-elevate disabled:opacity-30"
                style={{
                  borderColor: equipped ? "#fff" : "rgba(255,255,255,0.15)",
                  boxShadow: equipped ? `0 0 14px ${PAINT_HEX[idx]}` : undefined,
                  background: "rgba(0,0,0,0.4)",
                }}
              >
                <div className="rounded h-8 w-full" style={{ background: PAINT_HEX[idx], boxShadow: `0 0 8px ${PAINT_HEX[idx]}` }} />
                <div className="text-[9px] mt-1 text-white/70">{equipped ? "ON" : cost === 0 ? "FREE" : cost}</div>
              </button>
            );
          })}
        </div>

        {/* Close */}
        <div className="flex gap-2 mt-5">
          <button onClick={close} className="neon-btn neon-btn-cyan rounded px-5 py-3 text-base font-black flex-1">
            ✓ DONE
          </button>
        </div>
      </div>
    </div>
  );
}
