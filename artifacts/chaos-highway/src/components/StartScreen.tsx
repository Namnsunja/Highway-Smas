import { useEffect, useMemo, useState } from "react";
import type { SaveData } from "@/game/Storage";
import { getMixedLeaderboard } from "@/game/Storage";

interface Props {
  save: SaveData;
  onPlay: () => void;
  onShop: () => void;
  onLeaderboard: () => void;
  onToggleMute: () => void;
}

export function StartScreen({ save, onPlay, onShop, onLeaderboard, onToggleMute }: Props) {
  const [showTags, setShowTags] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowTags(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 z-20"
         style={{ background: "radial-gradient(ellipse at center, rgba(42, 10, 58, 0.85) 0%, rgba(10, 6, 18, 0.98) 75%)" }}>
      <div className="w-full max-w-3xl flex flex-col items-center">
        <div className="text-center mb-2">
          <div className="neon-text-cyan text-xs sm:text-sm tracking-[0.3em] mb-2">POST-APOCALYPSE EDITION</div>
          <h1 className="neon-title text-5xl sm:text-7xl md:text-8xl leading-none">
            CHAOS
          </h1>
          <h1 className="neon-title text-5xl sm:text-7xl md:text-8xl leading-none -mt-1 sm:-mt-2">
            HIGHWAY
          </h1>
          <h2 className="neon-text-yellow text-3xl sm:text-5xl md:text-6xl mt-1 font-black tracking-wider">SMASH&nbsp;3D</h2>
        </div>

        <p className="text-center text-white/85 text-sm sm:text-base max-w-xl mt-5 px-2 leading-snug">
          Rampage through 5 wild levels of endless traffic. Smash cars, trigger
          chain explosions, blast through Toxic, Inferno and Cyberpunk zones,
          upgrade your wrecking machine, and climb the leaderboard.
        </p>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-4 text-[11px] sm:text-xs text-white/60 uppercase tracking-widest max-w-xl">
          {showTags && (
            <>
              <span>3D</span>
              <span>•</span>
              <span>Car Destruction</span>
              <span>•</span>
              <span>5 Levels</span>
              <span>•</span>
              <span>Smash</span>
              <span>•</span>
              <span>Physics</span>
              <span>•</span>
              <span>Apocalypse</span>
              <span>•</span>
              <span>High Score</span>
            </>
          )}
        </div>

        <button
          onClick={onPlay}
          className="neon-btn mt-7 px-12 py-4 text-2xl sm:text-3xl rounded-md pulse-glow"
        >
          ▶ PLAY
        </button>

        <div className="grid grid-cols-2 gap-3 mt-5 w-full max-w-md">
          <button
            onClick={onShop}
            className="neon-btn neon-btn-yellow px-4 py-3 text-base rounded-md"
          >
            🔧 GARAGE / SHOP
          </button>
          <button
            onClick={onLeaderboard}
            className="neon-btn neon-btn-cyan px-4 py-3 text-base rounded-md"
          >
            🏆 LEADERBOARD
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-6 w-full max-w-md text-center">
          <div className="hud-pill rounded-md py-2">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">High Score</div>
            <div className="text-xl neon-text-yellow font-black">{save.highScore.toLocaleString()}</div>
          </div>
          <div className="hud-pill rounded-md py-2">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">Last Run</div>
            <div className="text-xl neon-text-cyan font-black">{save.lastDistance.toLocaleString()}m</div>
          </div>
          <div className="hud-pill rounded-md py-2">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300/80">Scrap</div>
            <div className="text-xl neon-text-green font-black">{save.totalScrap.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-6 text-xs text-white/55">
          <button
            onClick={onToggleMute}
            className="px-3 py-1.5 rounded border border-white/30 hover:border-white/70 hover:text-white transition"
          >
            {save.muted ? "🔇 Sound: OFF" : "🔊 Sound: ON"}
          </button>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">Desktop: Arrows / WASD · Space = Boost</span>
          <span className="sm:hidden">Tap & hold for joystick</span>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardOverlay({
  save,
  onClose,
}: {
  save: SaveData;
  onClose: () => void;
}) {
  const list = useMemo(() => getMixedLeaderboard(save.playerEntries), [save.playerEntries]);
  const playerCount = save.playerEntries.length;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4"
         style={{ background: "rgba(5, 2, 12, 0.78)" }}>
      <div className="panel rounded-xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="neon-text-yellow text-2xl font-black">🏆 LEADERBOARD</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="text-xs text-white/55 mb-3 uppercase tracking-widest">Top wreckers worldwide</div>
        <div className="grid grid-cols-12 gap-2 px-3 pb-1.5 text-[10px] uppercase tracking-widest text-white/40">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Driver</div>
          <div className="col-span-2 text-center">Lvl</div>
          <div className="col-span-4 text-right">Score</div>
        </div>
        <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto scrollbar-thin pr-1">
          {list.map((row) => (
            <li key={`${row.name}-${row.ts}-${row.rank}`}
                className={`grid grid-cols-12 gap-2 items-center rounded px-3 py-2 ${row.isPlayer ? "neon-text-pink border border-pink-500/60" : "border border-white/10"}`}
                style={row.isPlayer ? { background: "rgba(255, 43, 214, 0.12)" } : { background: "rgba(255,255,255,0.03)" }}>
              <span className={`col-span-1 font-black ${row.rank <= 3 ? "neon-text-yellow" : "text-white/60"}`}>#{row.rank}</span>
              <span className="col-span-5 font-bold truncate flex items-center gap-1.5">
                {row.isPlayer && <span className="text-[9px] uppercase tracking-widest neon-text-pink">YOU</span>}
                <span className="truncate">{row.name}</span>
              </span>
              <span className="col-span-2 text-center text-xs neon-text-cyan font-mono font-black">L{row.level}</span>
              <span className="col-span-4 font-mono text-sm text-right">{row.score.toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <div className="text-[10px] text-white/40 mt-3 text-center italic">
          {playerCount === 0
            ? "Finish a run to enter your name on the board!"
            : `${playerCount} of your runs on the board • Online ranks shown for motivation.`}
        </div>
      </div>
    </div>
  );
}
