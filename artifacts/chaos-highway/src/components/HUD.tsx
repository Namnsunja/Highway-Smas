import { useEffect, useRef, useState, type ReactNode } from "react";
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

interface TutorialStep {
  title: string;
  desktopBody: ReactNode;
  mobileBody: ReactNode;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "STEER",
    desktopBody: (
      <>
        <div>Use <span className="neon-text-cyan font-bold">A / D</span> or <span className="neon-text-cyan font-bold">←/→</span> to swerve between lanes.</div>
        <div className="text-xs text-white/60 mt-1">Avoid heavy trucks — smash little cars instead.</div>
      </>
    ),
    mobileBody: (
      <>
        <div>Drag the <span className="neon-text-cyan font-bold">joystick</span> left or right to steer.</div>
        <div className="text-xs text-white/60 mt-1">Avoid heavy trucks — smash little cars instead.</div>
      </>
    ),
  },
  {
    title: "BRAKE",
    desktopBody: (
      <>
        <div>Hold <span className="neon-text-cyan font-bold">S</span> or <span className="neon-text-cyan font-bold">↓</span> to brake.</div>
        <div className="text-xs text-white/60 mt-1">Slow down through tight traffic to thread the needle.</div>
      </>
    ),
    mobileBody: (
      <>
        <div>Tap & hold the <span className="neon-text-cyan font-bold">BRAKE</span> button to slow down.</div>
        <div className="text-xs text-white/60 mt-1">Useful when traffic gets crowded.</div>
      </>
    ),
  },
  {
    title: "BOOST",
    desktopBody: (
      <>
        <div>Hold <span className="neon-text-cyan font-bold">SPACE</span> or <span className="neon-text-cyan font-bold">SHIFT</span> for nitro boost.</div>
        <div className="text-xs text-white/60 mt-1">Boosting drains the blue meter — pickups refill it.</div>
      </>
    ),
    mobileBody: (
      <>
        <div>Hold the <span className="neon-text-cyan font-bold">BOOST</span> button for nitro.</div>
        <div className="text-xs text-white/60 mt-1">Boosting drains the blue meter — pickups refill it.</div>
      </>
    ),
  },
  {
    title: "SMASH!",
    desktopBody: (
      <>
        <div>Ram cars to <span className="neon-text-pink font-bold">smash</span> them and build a chain.</div>
        <div className="text-xs text-white/60 mt-1">Each level cleared rewards HP, boost & bonus points!</div>
      </>
    ),
    mobileBody: (
      <>
        <div>Ram cars to <span className="neon-text-pink font-bold">smash</span> them and build a chain.</div>
        <div className="text-xs text-white/60 mt-1">Each level cleared rewards HP, boost & bonus points!</div>
      </>
    ),
  },
];

export function HUD({ hud, onPause, showTutorial, onDismissTutorial }: Props) {
  const [chainPulse, setChainPulse] = useState(0);
  const lastChain = useRef(1);
  const [tutStep, setTutStep] = useState(0);

  // Reset to step 0 whenever the tutorial is shown
  useEffect(() => {
    if (showTutorial) setTutStep(0);
  }, [showTutorial]);

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

      {/* Multi-step tutorial — Steer → Brake → Boost → Smash */}
      {showTutorial && (() => {
        const step = TUTORIAL_STEPS[tutStep] ?? TUTORIAL_STEPS[0]!;
        const isLast = tutStep >= TUTORIAL_STEPS.length - 1;
        return (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto"
               style={{ background: "rgba(0,0,0,0.45)" }}>
            <div className="panel rounded-xl px-6 py-5 text-center w-[88%] max-w-sm"
                 onClick={(e) => e.stopPropagation()}>
              <div className="text-[10px] tracking-[0.4em] text-white/60 mb-1">
                STEP {tutStep + 1} / {TUTORIAL_STEPS.length}
              </div>
              <div className="neon-text-pink font-black text-2xl mb-3">{step.title}</div>
              <div className="text-sm text-white/85 leading-relaxed desktop-only mb-1">
                {step.desktopBody}
              </div>
              <div className="text-sm text-white/85 leading-relaxed mobile-only mb-1">
                {step.mobileBody}
              </div>
              {/* Step dots */}
              <div className="flex justify-center gap-1.5 my-3">
                {TUTORIAL_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 8, height: 8,
                      background: i === tutStep ? "#ff2bd6" : "rgba(255,255,255,0.25)",
                      boxShadow: i === tutStep ? "0 0 8px #ff2bd6" : "none",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={onDismissTutorial}
                  className="hud-pill rounded-md px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                >
                  Skip
                </button>
                {!isLast ? (
                  <button
                    onClick={() => setTutStep((s) => Math.min(TUTORIAL_STEPS.length - 1, s + 1))}
                    className="hud-pill rounded-md px-5 py-2 text-sm font-black neon-text-cyan hover:bg-white/10"
                    style={{ borderColor: "rgba(0, 240, 255, 0.65)" }}
                  >
                    Next ▸
                  </button>
                ) : (
                  <button
                    onClick={onDismissTutorial}
                    className="hud-pill rounded-md px-5 py-2 text-sm font-black neon-text-yellow hover:bg-white/10"
                    style={{ borderColor: "rgba(255, 212, 0, 0.65)" }}
                  >
                    LET'S GO!
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
