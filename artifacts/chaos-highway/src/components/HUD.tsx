import { useEffect, useRef, useState } from "react";
import type { ActivePower, HudData } from "@/game/Game";

interface Props {
  hud: HudData | null;
  onPause: () => void;
  showTutorial: boolean;
  onDismissTutorial: () => void;
}

const POWER_LABELS: Record<ActivePower["kind"], { label: string; color: string }> = {
  nitro: { label: "NITRO", color: "#00f0ff" },
  magnet: { label: "MAGNET", color: "#ff2bd6" },
  repair: { label: "REPAIR", color: "#5eff7c" },
  mega: { label: "MEGA SMASH", color: "#ffd400" },
};

export function HUD({ hud, onPause, showTutorial, onDismissTutorial }: Props) {
  const [chainPulse, setChainPulse] = useState(0);
  const lastChain = useRef(1);

  useEffect(() => {
    if (!hud) return;
    if (hud.multiplier > 1 && hud.multiplier !== lastChain.current) {
      setChainPulse((p) => p + 1);
      lastChain.current = hud.multiplier;
    }
    if (hud.multiplier <= 1) lastChain.current = 1;
  }, [hud]);

  if (!hud) return null;

  const healthPct = Math.max(0, (hud.health / hud.maxHealth) * 100);
  const boostPct = Math.max(0, (hud.boost / hud.boostMax) * 100);
  const power = hud.activePower;

  return (
    <div className="ui-layer">
      {/* Top bar: distance/score/scrap */}
      <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 sm:gap-2 pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hud-pill rounded-md px-3 py-1.5 text-center">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-cyan-300/80">Distance</div>
            <div className="text-sm sm:text-lg font-black neon-text-cyan font-mono">{hud.distance.toLocaleString()}m</div>
          </div>
          <div className="hud-pill rounded-md px-4 py-1.5 text-center" style={{ borderColor: "rgba(255, 212, 0, 0.65)", boxShadow: "0 0 10px rgba(255, 212, 0, 0.4)" }}>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-yellow-300/80">Score</div>
            <div className="text-base sm:text-xl font-black neon-text-yellow font-mono">{hud.score.toLocaleString()}</div>
          </div>
          <div className="hud-pill rounded-md px-3 py-1.5 text-center" style={{ borderColor: "rgba(94, 255, 124, 0.65)", boxShadow: "0 0 10px rgba(94, 255, 124, 0.35)" }}>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-green-300/80">Scrap</div>
            <div className="text-sm sm:text-lg font-black neon-text-green font-mono">{hud.scrap.toLocaleString()}</div>
          </div>
        </div>
        {/* Level pill + progress bar */}
        <div className="hud-pill rounded-md px-3 py-1 flex items-center gap-2"
             style={{ borderColor: "rgba(255, 43, 214, 0.65)", boxShadow: "0 0 10px rgba(255, 43, 214, 0.35)" }}>
          <div className="text-[10px] sm:text-xs neon-text-pink font-black tracking-widest">LV {hud.level}</div>
          <div className="text-[10px] sm:text-xs text-white/85 font-bold tracking-wider">{hud.levelName}</div>
          <div className="w-16 sm:w-24 h-1 bg-white/15 rounded overflow-hidden">
            <div className="h-full" style={{
              width: `${Math.round(hud.levelProgress * 100)}%`,
              background: "linear-gradient(90deg, #ff2bd6, #ffd400)",
              boxShadow: "0 0 6px #ff2bd6",
            }} />
          </div>
        </div>
      </div>

      {/* Pause button */}
      <button
        onClick={onPause}
        aria-label="Pause"
        className="absolute top-2 right-2 sm:top-4 sm:right-4 hud-pill rounded-md px-3 py-2 text-white text-sm font-black hover:bg-white/10"
      >
        ⏸
      </button>

      {/* Chain multiplier (center, big) */}
      {hud.multiplier > 1 && (
        <div
          key={chainPulse}
          className="absolute left-1/2 top-20 sm:top-24 -translate-x-1/2 pointer-events-none"
          style={{ animation: "floatUp 1.4s ease-out infinite" }}
        >
          <div className="neon-text-pink text-3xl sm:text-5xl font-black tracking-widest">
            x{hud.multiplier} CHAIN!
          </div>
        </div>
      )}

      {/* Active power-up */}
      {power && (
        <div className="absolute top-16 sm:top-20 left-3 hud-pill rounded-md px-3 py-1.5 pointer-events-none"
             style={{ borderColor: power && POWER_LABELS[power.kind].color, boxShadow: `0 0 14px ${POWER_LABELS[power.kind].color}` }}>
          <div className="text-[10px] uppercase tracking-widest text-white/70">Active</div>
          <div className="font-black text-sm" style={{ color: POWER_LABELS[power.kind].color }}>
            {POWER_LABELS[power.kind].label}
          </div>
          <div className="w-24 h-1 bg-white/20 rounded mt-1 overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, (power.remaining / power.duration) * 100)}%`,
                background: POWER_LABELS[power.kind].color,
                boxShadow: `0 0 6px ${POWER_LABELS[power.kind].color}`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom-left HUD: health, boost, speed */}
      <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 w-[55%] max-w-xs space-y-2 pointer-events-none">
        <div>
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] uppercase tracking-widest text-white/70">Hull</span>
            <span className="text-xs font-mono text-white/80">{Math.ceil(hud.health)} / {hud.maxHealth}</span>
          </div>
          <div className="health-bar-bg rounded-md h-3 overflow-hidden mt-0.5">
            <div className="health-bar-fill h-full" style={{ width: `${healthPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] uppercase tracking-widest text-white/70">Boost</span>
            <span className="text-xs font-mono text-white/80">{Math.ceil(hud.boost)}</span>
          </div>
          <div className="health-bar-bg rounded-md h-2 overflow-hidden mt-0.5" style={{ borderColor: "rgba(0, 240, 255, 0.7)" }}>
            <div className="boost-bar-fill h-full" style={{ width: `${boostPct}%` }} />
          </div>
        </div>
      </div>

      {/* Speed (bottom right corner) */}
      <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 hud-pill rounded-md px-3 py-1.5 text-right pointer-events-none">
        <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">Speed</div>
        <div className="text-lg sm:text-2xl font-mono neon-text-cyan font-black">{hud.speedKmh}</div>
        <div className="text-[9px] text-white/50">km/h</div>
      </div>

      {/* Tutorial toast */}
      {showTutorial && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 panel rounded-xl px-6 py-5 text-center max-w-xs pointer-events-auto"
             onClick={onDismissTutorial}>
          <div className="neon-text-pink font-black text-xl mb-2">CONTROLS</div>
          <div className="text-sm text-white/85 leading-relaxed desktop-only">
            <div><span className="neon-text-cyan font-bold">A/D</span> or arrows = steer</div>
            <div><span className="neon-text-cyan font-bold">SPACE</span> = nitro boost</div>
          </div>
          <div className="text-sm text-white/85 leading-relaxed mobile-only">
            <div><span className="neon-text-cyan font-bold">Joystick</span> = steer</div>
            <div><span className="neon-text-cyan font-bold">BOOST</span> button = nitro</div>
          </div>
          <div className="text-xs text-white/50 mt-3">Tap to dismiss</div>
        </div>
      )}
    </div>
  );
}
