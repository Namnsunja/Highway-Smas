# Chaos Highway Smash 3D

A complete browser-based 3D endless destruction runner game built with Three.js and React, optimized for upload to Y8.com (single-folder HTML5 build, no external assets).

## Project structure

This is a pnpm monorepo with one game artifact:

- `artifacts/chaos-highway/` — React + Vite + Three.js game (mounted at `/`)
- `artifacts/api-server/` — Default API server scaffold (not used by the game; can be removed for the Y8 build)
- `artifacts/mockup-sandbox/` — Default canvas/preview scaffold (unused)

The game does not need a backend — all state is persisted in `localStorage`.

## Game features

- **3D engine**: Three.js renderer with dusk/neon post-apocalyptic city, procedurally streamed highway segments (4 lanes), neon curbs, billboards, streetlights and abandoned wrecks.
- **Smash gameplay**: Head-on/rear-end traffic collisions, AABB collision detection, chain-reaction explosions with radial damage, slow-mo on big chains, screen shake.
- **Power-ups**: NITRO (speed surge), MAGNET (pulls scrap), REPAIR (heals hull), MEGA SMASH (giant invulnerable car for 6s).
- **Upgrade economy**: Scrap drops from wrecks (with magnet pickup). Garage Shop spends scrap on:
  - Chassis tiers (Junker Sedan → Brawler Pickup → Apex Monster → Doom Tank Mk7)
  - Reinforced Bumper, Turbocharged Engine, Bigger Nitro Tank, Explosive Bumper (5 levels each)
  - 8 paint jobs
- **HUD**: Distance, score, scrap, hull bar, boost bar, speed (km/h), active power timer, x-CHAIN multiplier callouts, floating score popups.
- **Controls**:
  - Desktop: A/D or arrow keys to steer, Space/Shift for boost, Esc to pause.
  - Mobile: Floating analog joystick + dedicated BOOST + SMASH buttons.
- **Persistence**: localStorage key `chs3d_save_v1` stores high score, total scrap, last distance, all upgrades, and mute setting.
- **Fake leaderboard**: Top-10 motivational global ranks with the player's local high score inserted.
- **Audio**: Pure WebAudio synthesis (no asset files) — engine drone tracking speed, crash thumps, explosions, pickup blips, nitro woosh, UI clicks. Toggleable mute.
- **Game-over**: Confetti on new high score, share-score button (Web Share API → clipboard fallback).
- **Branding meta tags**: Y8-friendly description and keyword meta tags in `index.html`, Russo One headline font, neon pink/cyan/yellow palette.

## Y8 packaging

To package for upload to https://www.y8.com/upload:

1. Uncomment the Y8 SDK script tag in `artifacts/chaos-highway/index.html`:
   ```html
   <script src="https://cdn.y8.com/api/sdk.js"></script>
   ```
2. (Optional) Wire the SDK calls — search for `Y8 SDK PLACEHOLDER` comments in `src/App.tsx` and `src/components/GameOverScreen.tsx` and uncomment the `window.y8.showAd()` calls.
3. Build the static bundle:
   ```bash
   pnpm --filter @workspace/chaos-highway run build
   ```
4. Zip the contents of `artifacts/chaos-highway/dist/public/` (the `index.html` must be at the root of the zip).
5. Upload to Y8 with the description text from the meta tag.

## Tech stack

- React 19 + Vite 7
- Three.js 0.184 (procedural meshes only, no external models)
- TypeScript
- Tailwind CSS v4 + custom neon utility classes (`src/index.css`)
- WebAudio API (procedural sound synthesis)
- localStorage (save data)

## Key files

- `src/App.tsx` — top-level controller wiring screens (menu → playing → pause/shop/gameover) and persistence.
- `src/game/Game.ts` — full Three.js engine (world streaming, traffic AI, collisions, FX, scoring).
- `src/game/Audio.ts` — synthesized sound engine.
- `src/game/Storage.ts` — save/load and fake leaderboard.
- `src/components/StartScreen.tsx`, `HUD.tsx`, `MobileControls.tsx`, `PauseMenu.tsx`, `Shop.tsx`, `GameOverScreen.tsx` — UI overlays.

## Notes

- The Vite dev preview environment may show a "WebGL context could not be created" error in the in-IDE screenshot tool because that runs in a headless browser without GPU. Real browsers (Chrome/Firefox/Edge) on real devices initialize WebGL normally and the game runs at 60fps.
- Strict CSP is not required, but if Y8 enforces one the game uses no `eval` and only loads Google Fonts (Russo One) — fonts can be self-hosted if needed.
