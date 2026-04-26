import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Game, type HudData, type RunResult, type GameStatus } from "@/game/Game";
import { SoundEngine } from "@/game/Audio";
import {
  loadSave, writeSave, addPlayerEntry, qualifiesForLeaderboard,
  type SaveData,
} from "@/game/Storage";
import { StartScreen, LeaderboardOverlay } from "@/components/StartScreen";
import { HUD } from "@/components/HUD";
import { MobileControls } from "@/components/MobileControls";
import { PauseMenu } from "@/components/PauseMenu";
import { Shop } from "@/components/Shop";
import { GameOverScreen } from "@/components/GameOverScreen";

type View = "menu" | "playing" | "paused" | "shop" | "leaderboard" | "gameover";

interface FloatingScore {
  id: number;
  text: string;
  color: string;
}

interface LevelBanner {
  id: number;
  level: number;
  themeName: string;
  reward: { health: number; boost: number; bonus: number };
}

interface VictoryBanner {
  id: number;
  score: number;
  distance: number;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const scrapAtRunStartRef = useRef(0);

  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [view, setView] = useState<View>("menu");
  const [previousView, setPreviousView] = useState<View>("menu");
  const [hud, setHud] = useState<HudData | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [floats, setFloats] = useState<FloatingScore[]>([]);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [levelBanner, setLevelBanner] = useState<LevelBanner | null>(null);
  const [victoryBanner, setVictoryBanner] = useState<VictoryBanner | null>(null);
  const [submittedThisRun, setSubmittedThisRun] = useState(false);
  const floatId = useRef(0);
  const bannerId = useRef(0);
  const victoryId = useRef(0);

  // Init game once
  useEffect(() => {
    if (!containerRef.current) return;
    const sound = new SoundEngine(save.muted);
    soundRef.current = sound;

    let game: Game;
    try {
      game = new Game(containerRef.current, sound, {
      onHud: (h) => setHud(h),
      onStatus: (_s: GameStatus) => { /* status mirrored via setView from controller */ },
      onFloatingScore: (text, color) => {
        const id = ++floatId.current;
        setFloats((arr) => [...arr, { id, text, color }]);
        setTimeout(() => {
          setFloats((arr) => arr.filter((f) => f.id !== id));
        }, 1100);
      },
      onChainEvent: () => { /* extra UI hook */ },
      onShake: (s) => {
        setShakeTrigger((t) => t + 1);
        void s;
      },
      onLevelUp: (level, themeName, reward) => {
        const id = ++bannerId.current;
        setLevelBanner({ id, level, themeName, reward });
        setShakeTrigger((t) => t + 1);
        setTimeout(() => {
          setLevelBanner((b) => (b && b.id === id ? null : b));
        }, 3200);
      },
      onVictory: (result) => {
        const id = ++victoryId.current;
        setVictoryBanner({ id, score: result.score, distance: result.distance });
        setShakeTrigger((t) => t + 1);
        sound.powerup();
        setTimeout(() => {
          setVictoryBanner((b) => (b && b.id === id ? null : b));
        }, 5000);
      },
      onRunEnd: (result) => {
        sound.stopMusic();
        setSave((prev) => {
          const earnedScrap = (hudRef.current?.scrap ?? 0) - scrapAtRunStartRef.current;
          const newBank = prev.totalScrap + Math.max(0, earnedScrap);
          const newHigh = Math.max(prev.highScore, result.score);
          const next: SaveData = {
            ...prev,
            totalScrap: newBank,
            highScore: newHigh,
            lastDistance: result.distance,
          };
          writeSave(next);
          return next;
        });
        setRunResult(result);
        setSubmittedThisRun(false);
        setView("gameover");
      },
      });
    } catch (err) {
      console.error("Game init failed", err);
      return;
    }
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hudRef = useRef<HudData | null>(null);
  useEffect(() => { hudRef.current = hud; }, [hud]);

  useEffect(() => {
    soundRef.current?.setMuted(save.muted);
  }, [save.muted]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && view === "playing") {
        gameRef.current?.pause();
        setPreviousView("playing");
        setView("paused");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [view]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        if (view === "playing") {
          gameRef.current?.pause();
          setPreviousView(view);
          setView("paused");
        } else if (view === "paused") {
          gameRef.current?.resume();
          setView("playing");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  const startRun = useCallback(() => {
    soundRef.current?.start();
    soundRef.current?.uiClick();
    soundRef.current?.startMusic(1);
    scrapAtRunStartRef.current = save.totalScrap;
    gameRef.current?.start(save.upgrades, save.totalScrap, save.highScore);
    setRunResult(null);
    setHud(null);
    setLevelBanner(null);
    setVictoryBanner(null);
    setSubmittedThisRun(false);
    setView("playing");
    const seen = window.localStorage.getItem("chs3d_tut_seen");
    if (!seen) {
      setShowTutorial(true);
      window.localStorage.setItem("chs3d_tut_seen", "1");
    }
  }, [save.upgrades, save.totalScrap, save.highScore]);

  const onRetry = useCallback(() => {
    soundRef.current?.uiClick();
    soundRef.current?.startMusic(1);
    scrapAtRunStartRef.current = save.totalScrap;
    gameRef.current?.start(save.upgrades, save.totalScrap, save.highScore);
    setRunResult(null);
    setHud(null);
    setLevelBanner(null);
    setVictoryBanner(null);
    setSubmittedThisRun(false);
    setView("playing");
  }, [save.upgrades, save.totalScrap, save.highScore]);

  const onPause = useCallback(() => {
    if (view !== "playing") return;
    gameRef.current?.pause();
    soundRef.current?.uiClick();
    setPreviousView("playing");
    setView("paused");
  }, [view]);

  const onResume = useCallback(() => {
    soundRef.current?.uiClick();
    gameRef.current?.resume();
    setView("playing");
  }, []);

  const onShopFromMenu = useCallback(() => {
    soundRef.current?.start();
    soundRef.current?.uiClick();
    setPreviousView(view);
    setView("shop");
  }, [view]);

  const onShopFromPause = useCallback(() => {
    soundRef.current?.uiClick();
    setPreviousView("paused");
    setView("shop");
  }, []);

  const onShopFromGameOver = useCallback(() => {
    soundRef.current?.uiClick();
    setPreviousView("gameover");
    setView("shop");
  }, []);

  const onCloseShop = useCallback(() => {
    soundRef.current?.uiClick();
    if (previousView === "paused") setView("paused");
    else if (previousView === "gameover") setView("gameover");
    else setView("menu");
  }, [previousView]);

  const onApplyShop = useCallback((newScrap: number, newUp: SaveData["upgrades"]) => {
    setSave((prev) => {
      const next: SaveData = { ...prev, totalScrap: newScrap, upgrades: newUp };
      writeSave(next);
      return next;
    });
  }, []);

  const onMenu = useCallback(() => {
    soundRef.current?.uiClick();
    soundRef.current?.stopMusic();
    gameRef.current?.endRun();
    setView("menu");
  }, []);

  const onLeaderboard = useCallback(() => {
    soundRef.current?.start();
    soundRef.current?.uiClick();
    setPreviousView(view);
    setView("leaderboard");
  }, [view]);

  const onCloseLeaderboard = useCallback(() => {
    soundRef.current?.uiClick();
    setView(previousView);
  }, [previousView]);

  const toggleMute = useCallback(() => {
    soundRef.current?.uiClick();
    setSave((prev) => {
      const next = { ...prev, muted: !prev.muted };
      writeSave(next);
      return next;
    });
  }, []);

  const onShare = useCallback(async () => {
    if (!runResult) return;
    const text = `I just smashed ${runResult.score.toLocaleString()} points on Level ${runResult.level} of Chaos Highway Smash 3D! Distance: ${runResult.distance.toLocaleString()}m, best chain x${runResult.bestChain}. Try to beat me!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Chaos Highway Smash 3D", text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Score copied to clipboard! Share with friends.");
      }
    } catch {
      /* ignore */
    }
  }, [runResult]);

  const onSubmitLeaderboardName = useCallback((name: string) => {
    if (!runResult) return;
    soundRef.current?.uiClick();
    setSave((prev) => {
      const next = addPlayerEntry(prev, {
        name,
        score: runResult.score,
        distance: runResult.distance,
        level: runResult.level,
      });
      writeSave(next);
      return next;
    });
    setSubmittedThisRun(true);
  }, [runResult]);

  const onSteer = useCallback((v: number) => gameRef.current?.setMobileSteer(v), []);
  const onBoostHold = useCallback((v: boolean) => gameRef.current?.setMobileBoost(v), []);
  const onBrakeHold = useCallback((v: boolean) => gameRef.current?.setMobileBrake(v), []);
  const onPower = useCallback(() => gameRef.current?.triggerPower(), []);

  const rootClass = useMemo(() => `game-root ${shakeTrigger > 0 ? "shake" : ""}`, [shakeTrigger]);
  useEffect(() => {
    if (shakeTrigger === 0) return;
    const t = setTimeout(() => setShakeTrigger(0), 450);
    return () => clearTimeout(t);
  }, [shakeTrigger]);

  const qualifies = useMemo(
    () => (runResult ? qualifiesForLeaderboard(runResult.score, save.playerEntries) : false),
    [runResult, save.playerEntries],
  );

  return (
    <div className={rootClass}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Floating score popups */}
      <div className="ui-layer pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {floats.map((f, idx) => (
            <div
              key={f.id}
              className="absolute float-up font-black text-2xl sm:text-3xl whitespace-nowrap"
              style={{
                left: "50%",
                top: `${idx * 18}px`,
                color: f.color,
                textShadow: `0 0 10px ${f.color}, 0 0 20px ${f.color}`,
                transform: "translate(-50%, 0)",
              }}
            >
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {/* Level-up banner */}
      {levelBanner && view === "playing" && (
        <div key={levelBanner.id}
             className="absolute inset-x-0 top-1/4 z-40 flex flex-col items-center pointer-events-none"
             style={{ animation: "levelBannerIn 0.6s ease-out" }}>
          <div className="text-xs neon-text-cyan tracking-[0.5em] mb-1">▸ LEVEL UP ◂</div>
          <div className="neon-title text-5xl sm:text-7xl tracking-widest">
            LEVEL {levelBanner.level}
          </div>
          <div className="neon-text-yellow text-2xl sm:text-3xl font-black tracking-widest mt-1 uppercase">
            {levelBanner.themeName}
          </div>
          <div className="mt-3 flex gap-4 text-sm sm:text-base font-bold">
            <span className="neon-text-pink">+{levelBanner.reward.health} HP</span>
            <span className="neon-text-cyan">+{levelBanner.reward.boost} BOOST</span>
            <span className="neon-text-yellow">+{levelBanner.reward.bonus.toLocaleString()} PTS</span>
          </div>
        </div>
      )}

      {/* Victory banner — final level cleared */}
      {victoryBanner && view === "playing" && (
        <div key={victoryBanner.id}
             className="absolute inset-x-0 top-1/4 z-40 flex flex-col items-center pointer-events-none"
             style={{ animation: "levelBannerIn 0.6s ease-out" }}>
          <div className="text-xs neon-text-yellow tracking-[0.5em] mb-1">★ HIGHWAY CONQUERED ★</div>
          <div className="neon-title text-5xl sm:text-7xl tracking-widest">VICTORY!</div>
          <div className="neon-text-cyan text-xl sm:text-2xl font-black tracking-widest mt-2 uppercase">
            All 5 zones cleared
          </div>
          <div className="mt-3 flex gap-4 text-sm sm:text-base font-bold">
            <span className="neon-text-yellow">+5,000 BONUS</span>
            <span className="neon-text-pink">FULL REPAIR</span>
          </div>
          <div className="mt-2 neon-text-cyan text-xs tracking-widest">
            Endless mode unlocked — keep smashing!
          </div>
        </div>
      )}

      {/* HUD always rendered when playing */}
      {(view === "playing" || view === "paused") && (
        <HUD
          hud={hud}
          onPause={onPause}
          showTutorial={showTutorial && view === "playing"}
          onDismissTutorial={() => setShowTutorial(false)}
        />
      )}

      {view === "playing" && (
        <MobileControls
          onSteer={onSteer}
          onBoostHold={onBoostHold}
          onBrakeHold={onBrakeHold}
          onPower={onPower}
        />
      )}

      {view === "menu" && (
        <StartScreen
          save={save}
          onPlay={startRun}
          onShop={onShopFromMenu}
          onLeaderboard={onLeaderboard}
          onToggleMute={toggleMute}
        />
      )}

      {view === "paused" && (
        <PauseMenu
          onResume={onResume}
          onShop={onShopFromPause}
          onMenu={onMenu}
          muted={save.muted}
          onToggleMute={toggleMute}
        />
      )}

      {view === "shop" && (
        <Shop
          scrap={save.totalScrap}
          upgrades={save.upgrades}
          onClose={onCloseShop}
          onApply={onApplyShop}
        />
      )}

      {view === "leaderboard" && (
        <LeaderboardOverlay save={save} onClose={onCloseLeaderboard} />
      )}

      {view === "gameover" && runResult && (
        <GameOverScreen
          result={runResult}
          highScore={save.highScore}
          qualifiesForBoard={qualifies}
          defaultName={save.lastPlayerName}
          alreadySubmitted={submittedThisRun}
          onSubmitName={onSubmitLeaderboardName}
          onRetry={onRetry}
          onShop={onShopFromGameOver}
          onMenu={onMenu}
          onShare={onShare}
        />
      )}
    </div>
  );
}
