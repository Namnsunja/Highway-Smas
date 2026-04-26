import { useEffect, useRef, useState } from "react";

interface Props {
  onSteer: (v: number) => void;
  onBoostHold: (v: boolean) => void;
  onPower: () => void;
}

const JOY_RADIUS = 60; // visual radius
const KNOB_RADIUS = 28;

export function MobileControls({ onSteer, onBoostHold, onPower }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const touchId = useRef<number | null>(null);
  const center = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMove = (e: TouchEvent) => {
      if (touchId.current === null || !center.current || !knobRef.current) return;
      let touch: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i]!.identifier === touchId.current) {
          touch = e.touches[i]!;
          break;
        }
      }
      if (!touch) return;
      const dx = touch.clientX - center.current.x;
      const dy = touch.clientY - center.current.y;
      const dist = Math.hypot(dx, dy);
      const max = JOY_RADIUS;
      const cx = (dist > max ? (dx / dist) * max : dx);
      const cy = (dist > max ? (dy / dist) * max : dy);
      knobRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
      const steer = cx / max;
      onSteer(steer);
    };
    const handleEnd = (e: TouchEvent) => {
      if (touchId.current === null) return;
      let stillThere = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i]!.identifier === touchId.current) {
          stillThere = true;
          break;
        }
      }
      if (stillThere) return;
      touchId.current = null;
      center.current = null;
      setActive(false);
      if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
      onSteer(0);
    };
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);
    return () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [onSteer]);

  const onJoyStart = (e: React.TouchEvent) => {
    if (touchId.current !== null) return;
    const t = e.changedTouches[0]!;
    touchId.current = t.identifier;
    if (baseRef.current) {
      const r = baseRef.current.getBoundingClientRect();
      center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    setActive(true);
    e.preventDefault();
  };

  return (
    <div className="ui-layer mobile-only">
      {/* Joystick */}
      <div className="absolute bottom-24 left-6">
        <div
          ref={baseRef}
          onTouchStart={onJoyStart}
          className="joystick-base rounded-full flex items-center justify-center touch-none select-none"
          style={{ width: JOY_RADIUS * 2 + 10, height: JOY_RADIUS * 2 + 10 }}
        >
          <div
            ref={knobRef}
            className="joystick-knob rounded-full pointer-events-none"
            style={{ width: KNOB_RADIUS * 2, height: KNOB_RADIUS * 2, transform: "translate(0,0)", opacity: active ? 1 : 0.85 }}
          />
        </div>
      </div>

      {/* Boost + Power buttons */}
      <div className="absolute bottom-24 right-5 flex flex-col items-end gap-3">
        <button
          onTouchStart={(e) => { e.preventDefault(); onBoostHold(true); }}
          onTouchEnd={(e) => { e.preventDefault(); onBoostHold(false); }}
          onTouchCancel={(e) => { e.preventDefault(); onBoostHold(false); }}
          className="touch-btn rounded-full text-base"
          style={{ width: 92, height: 92 }}
        >
          BOOST
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); onPower(); }}
          className="touch-btn touch-btn-cyan rounded-full text-xs"
          style={{ width: 64, height: 64 }}
        >
          SMASH
        </button>
      </div>
    </div>
  );
}
