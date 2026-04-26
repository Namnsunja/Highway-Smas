interface Props {
  onResume: () => void;
  onShop: () => void;
  onMenu: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function PauseMenu({ onResume, onShop, onMenu, muted, onToggleMute }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4"
         style={{ background: "rgba(5, 2, 12, 0.75)" }}>
      <div className="panel rounded-xl p-7 w-full max-w-sm text-center">
        <h3 className="neon-text-pink text-3xl font-black mb-1">PAUSED</h3>
        <p className="text-white/60 text-xs mb-5 tracking-widest">Catch your breath, driver.</p>
        <div className="flex flex-col gap-3">
          <button onClick={onResume} className="neon-btn px-6 py-3 rounded-md text-lg">▶ RESUME</button>
          <button onClick={onShop} className="neon-btn neon-btn-yellow px-6 py-3 rounded-md text-lg">🔧 GARAGE</button>
          <button onClick={onMenu} className="neon-btn neon-btn-cyan px-6 py-3 rounded-md text-lg">⌂ MAIN MENU</button>
          <button onClick={onToggleMute} className="text-xs text-white/60 hover:text-white mt-1">
            {muted ? "🔇 Sound: OFF" : "🔊 Sound: ON"}
          </button>
        </div>
      </div>
    </div>
  );
}
