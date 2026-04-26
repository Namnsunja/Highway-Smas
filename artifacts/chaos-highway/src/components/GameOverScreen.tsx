import { useEffect, useRef, useState } from "react";
import type { RunResult } from "@/game/Game";

interface Props {
  result: RunResult;
  highScore: number;
  qualifiesForBoard: boolean;
  defaultName: string;
  alreadySubmitted: boolean;
  onSubmitName: (name: string) => void;
  onRetry: () => void;
  onShop: () => void;
  onMenu: () => void;
  onShare: () => void;
}

export function GameOverScreen({
  result,
  highScore,
  qualifiesForBoard,
  defaultName,
  alreadySubmitted,
  onSubmitName,
  onRetry,
  onShop,
  onMenu,
  onShare,
}: Props) {
  const [showConfetti, setShowConfetti] = useState(result.newHighScore);
  const [name, setName] = useState(defaultName || "");
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (result.newHighScore) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [result.newHighScore]);

  useEffect(() => {
    if (qualifiesForBoard && !submitted) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [qualifiesForBoard, submitted]);

  const submit = () => {
    const clean = name.trim().slice(0, 14) || "ANON";
    onSubmitName(clean);
    setSubmitted(true);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4"
         style={{ background: "rgba(5, 2, 12, 0.78)" }}>
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => {
            const colors = ["#ff2bd6", "#00f0ff", "#ffd400", "#5eff7c", "#ff7a00"];
            const c = colors[i % colors.length];
            const left = Math.random() * 100;
            const dur = 2.2 + Math.random() * 2.2;
            const delay = Math.random() * 0.6;
            return (
              <span
                key={i}
                className="confetti-piece"
                style={{ left: `${left}%`, background: c, animationDuration: `${dur}s`, animationDelay: `${delay}s`, boxShadow: `0 0 8px ${c}` }}
              />
            );
          })}
        </div>
      )}
      <div className="panel rounded-xl p-6 sm:p-8 w-full max-w-md text-center relative">
        <h3 className="neon-text-pink text-3xl sm:text-4xl font-black mb-1">WRECKED!</h3>
        {result.newHighScore ? (
          <div className="neon-text-yellow text-base sm:text-lg font-black mb-3 tracking-widest pulse-glow">
            🎉 NEW HIGH SCORE!
          </div>
        ) : (
          <div className="text-white/60 text-xs sm:text-sm mb-3 uppercase tracking-widest">Beat your high score!</div>
        )}

        <div className="grid grid-cols-2 gap-2 my-4">
          <Stat label="Distance" value={`${result.distance.toLocaleString()}m`} color="#00f0ff" />
          <Stat label="Score" value={result.score.toLocaleString()} color="#ffd400" big />
          <Stat label="Reached Lv" value={`L${result.level}`} color="#ff2bd6" />
          <Stat label="Best Chain" value={`x${result.bestChain}`} color="#5eff7c" />
        </div>
        <div className="hud-pill rounded-md px-3 py-1 mb-3 text-xs text-white/70">
          High Score: <span className="neon-text-yellow font-mono font-black ml-1">{highScore.toLocaleString()}</span>
        </div>

        {/* Leaderboard name entry */}
        {qualifiesForBoard && !submitted && (
          <div className="rounded-md p-3 mb-3 border border-pink-500/50"
               style={{ background: "rgba(255, 43, 214, 0.10)" }}>
            <div className="neon-text-pink text-sm font-black tracking-widest mb-2">
              🏆 LEADERBOARD QUALIFIED!
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 14))}
                placeholder="Your driver name"
                maxLength={14}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                className="flex-1 bg-black/40 border border-white/30 rounded px-3 py-2 text-white font-mono outline-none focus:border-pink-400"
              />
              <button onClick={submit} className="neon-btn neon-btn-yellow px-4 py-2 rounded text-sm font-black">
                SAVE
              </button>
            </div>
          </div>
        )}
        {submitted && (
          <div className="text-xs neon-text-green tracking-widest mb-3 font-black">
            ✓ ADDED TO LEADERBOARD
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button onClick={onRetry} className="neon-btn px-6 py-3 rounded-md text-xl">🔄 PLAY AGAIN</button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onShop} className="neon-btn neon-btn-yellow px-3 py-2 rounded-md text-sm">🔧 GARAGE</button>
            <button onClick={onMenu} className="neon-btn neon-btn-cyan px-3 py-2 rounded-md text-sm">⌂ MENU</button>
          </div>
          <button onClick={onShare} className="text-xs text-white/60 hover:text-white mt-1 underline-offset-2 hover:underline">
            📸 Share your score
          </button>
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <div className="hud-pill rounded-md px-3 py-2"
         style={{ borderColor: `${color}aa`, boxShadow: `0 0 8px ${color}55` }}>
      <div className="text-[10px] uppercase tracking-widest text-white/60">{label}</div>
      <div className={`font-black font-mono ${big ? "text-xl" : "text-base"}`} style={{ color, textShadow: `0 0 8px ${color}` }}>
        {value}
      </div>
    </div>
  );
}
