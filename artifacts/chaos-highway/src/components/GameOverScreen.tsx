import { useEffect, useState } from "react";
import type { RunResult } from "@/game/Game";

interface Props {
  result: RunResult;
  highScore: number;
  onRetry: () => void;
  onShop: () => void;
  onMenu: () => void;
  onShare: () => void;
}

export function GameOverScreen({ result, highScore, onRetry, onShop, onMenu, onShare }: Props) {
  const [showConfetti, setShowConfetti] = useState(result.newHighScore);

  useEffect(() => {
    if (result.newHighScore) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [result.newHighScore]);

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
          <Stat label="Best Chain" value={`x${result.bestChain}`} color="#ff2bd6" />
          <Stat label="High Score" value={highScore.toLocaleString()} color="#5eff7c" />
        </div>

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

        {/* Y8 SDK PLACEHOLDER:
            // Show interstitial ad here:
            // if (window.y8) window.y8.showAd?.();
        */}
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
