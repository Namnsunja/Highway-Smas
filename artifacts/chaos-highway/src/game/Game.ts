import * as THREE from "three";
import { SoundEngine } from "./Audio";
import type { Upgrades } from "./Storage";

/* =========================================================================
 * Chaos Highway Smash 3D — core game engine.
 * Three.js renderer, custom lightweight physics, procedural infinite highway.
 * ========================================================================= */

export type GameStatus = "idle" | "playing" | "paused" | "gameover";

export interface GameCallbacks {
  onHud: (hud: HudData) => void;
  onStatus: (status: GameStatus) => void;
  onFloatingScore: (text: string, color: string) => void;
  onChainEvent: (chain: number) => void;
  onShake: (strength: number) => void;
  onRunEnd: (result: RunResult) => void;
}

export interface HudData {
  distance: number;
  score: number;
  multiplier: number;
  health: number;
  maxHealth: number;
  scrap: number;
  boost: number;
  boostMax: number;
  speedKmh: number;
  activePower: ActivePower | null;
  status: GameStatus;
}

export interface ActivePower {
  kind: "nitro" | "magnet" | "repair" | "mega";
  remaining: number;
  duration: number;
}

export interface RunResult {
  distance: number;
  score: number;
  scrap: number;
  newHighScore: boolean;
  bestChain: number;
}

const LANE_X = [-6, -2, 2, 6]; // 4 lanes
const LANE_HALF_WIDTH = 1.7;
const ROAD_HALF_WIDTH = 8.5;
const SEGMENT_LENGTH = 40;
const VISIBLE_AHEAD = 12;
const VISIBLE_BEHIND = 2;
const TRAFFIC_AHEAD = 240;
const TRAFFIC_BEHIND = 60;

// ---------- Helpers ----------
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------- Car factory (low-poly) ----------
interface CarParts {
  group: THREE.Group;
  body: THREE.Mesh;
  cab: THREE.Mesh;
  damageMaterial: THREE.MeshStandardMaterial;
}

const PAINT_COLORS = [
  0xff2bd6, // hot pink
  0x00f0ff, // cyan
  0xffd400, // yellow
  0xff4422, // red
  0x66ff66, // toxic green
  0xff7a00, // orange
  0x9b5cff, // purple
  0xffffff, // chrome white
];

function buildCarMesh(opts: {
  color: number;
  width: number;
  length: number;
  height: number;
  cabHeight?: number;
  isTruck?: boolean;
  isMonster?: boolean;
}): CarParts {
  const group = new THREE.Group();
  const w = opts.width;
  const l = opts.length;
  const h = opts.height;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: 0.45,
    metalness: 0.55,
    emissive: new THREE.Color(opts.color).multiplyScalar(0.05),
  });
  const bodyGeom = new THREE.BoxGeometry(w, h, l);
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = h / 2 + 0.35;
  body.castShadow = false;
  group.add(body);

  // Cab/cabin
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x111122,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0a1a2a,
    emissiveIntensity: 0.5,
  });
  const cabH = opts.cabHeight ?? h * 0.7;
  const cabL = opts.isTruck ? l * 0.35 : l * 0.55;
  const cabW = w * 0.85;
  const cabGeom = new THREE.BoxGeometry(cabW, cabH, cabL);
  const cab = new THREE.Mesh(cabGeom, cabMat);
  cab.position.set(0, h + cabH / 2 + 0.35, opts.isTruck ? -l * 0.15 : -l * 0.05);
  group.add(cab);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheelR = opts.isMonster ? 0.7 : 0.36;
  const wheelW = 0.28;
  const wheelGeom = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 10);
  wheelGeom.rotateZ(Math.PI / 2);
  const wheelOffsetX = w / 2 + 0.05;
  const wheelOffsetZ = l / 2 - 0.6;
  const positions: [number, number, number][] = [
    [wheelOffsetX, wheelR, wheelOffsetZ],
    [-wheelOffsetX, wheelR, wheelOffsetZ],
    [wheelOffsetX, wheelR, -wheelOffsetZ],
    [-wheelOffsetX, wheelR, -wheelOffsetZ],
  ];
  for (const p of positions) {
    const wm = new THREE.Mesh(wheelGeom, wheelMat);
    wm.position.set(p[0], p[1], p[2]);
    group.add(wm);
  }

  // Headlights — small emissive cubes
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 1.2,
  });
  const lightGeom = new THREE.BoxGeometry(0.35, 0.18, 0.1);
  const lightFL = new THREE.Mesh(lightGeom, lightMat);
  lightFL.position.set(w / 2 - 0.4, 0.7, l / 2 + 0.02);
  group.add(lightFL);
  const lightFR = new THREE.Mesh(lightGeom, lightMat);
  lightFR.position.set(-w / 2 + 0.4, 0.7, l / 2 + 0.02);
  group.add(lightFR);

  // Tail lights (red glow at back)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: 0xff0000,
    emissiveIntensity: 1.0,
  });
  const tailGeom = new THREE.BoxGeometry(0.32, 0.16, 0.08);
  const tailL = new THREE.Mesh(tailGeom, tailMat);
  tailL.position.set(w / 2 - 0.35, 0.7, -l / 2 - 0.02);
  group.add(tailL);
  const tailR = new THREE.Mesh(tailGeom, tailMat);
  tailR.position.set(-w / 2 + 0.35, 0.7, -l / 2 - 0.02);
  group.add(tailR);

  return { group, body, cab, damageMaterial: bodyMat };
}

// ---------- Player car definitions ----------
interface CarTier {
  name: string;
  width: number;
  length: number;
  height: number;
  isTruck: boolean;
  isMonster: boolean;
  baseHealth: number;
  baseSmash: number;
  cost: number;
  description: string;
}

export const CAR_TIERS: CarTier[] = [
  { name: "Junker Sedan", width: 1.9, length: 4.4, height: 1.0, isTruck: false, isMonster: false, baseHealth: 100, baseSmash: 1.0, cost: 0, description: "Reliable wreck. Where it all begins." },
  { name: "Brawler Pickup", width: 2.2, length: 5.2, height: 1.15, isTruck: true, isMonster: false, baseHealth: 145, baseSmash: 1.35, cost: 800, description: "Heavier frame, meaner bumper." },
  { name: "Apex Monster", width: 2.6, length: 5.4, height: 1.5, isTruck: false, isMonster: true, baseHealth: 200, baseSmash: 1.7, cost: 3500, description: "Giant tires. Crushes rooftops." },
  { name: "Doom Tank Mk7", width: 3.0, length: 6.6, height: 1.7, isTruck: true, isMonster: true, baseHealth: 280, baseSmash: 2.2, cost: 10000, description: "Apocalypse-grade rolling fortress." },
];

// ---------- Highway segment ----------
interface HighwaySegment {
  group: THREE.Group;
  startZ: number;
  endZ: number;
  decorations: THREE.Object3D[];
}

// ---------- Traffic / pickup entities ----------
interface TrafficCar {
  parts: CarParts;
  laneIdx: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  width: number;
  length: number;
  alive: boolean;
  health: number;
  isLarge: boolean;
  swayPhase: number;
  swerveBias: number;
}

interface DebrisPiece {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  shrink: number;
}

type PowerKind = "nitro" | "magnet" | "repair" | "mega";

interface PowerPickup {
  group: THREE.Group;
  position: THREE.Vector3;
  kind: PowerKind;
  alive: boolean;
  spinPhase: number;
}

interface ScrapPickup {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  alive: boolean;
  age: number;
  value: number;
}

interface Barrier {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  width: number;
  length: number;
  alive: boolean;
  health: number;
}

// ============================================================================
// Game class
// ============================================================================
export class Game {
  private container: HTMLElement;
  private callbacks: GameCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private ambient!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private fog!: THREE.Fog;

  private playerGroup!: THREE.Group;
  private playerParts!: CarParts;
  private playerCarTier!: CarTier;
  private playerHalfW = 1;
  private playerHalfL = 2.2;

  // Player state
  private playerX = 0; // lateral position
  private playerZ = 0; // forward (positive z = forward)
  private playerSpeed = 22; // m/s
  private maxSpeed = 90;
  private targetX = 0;
  private steerVel = 0;
  private health = 100;
  private maxHealth = 100;
  private scrap = 0;
  private score = 0;
  private chainCount = 0;
  private chainTimer = 0;
  private bestChain = 0;
  private boost = 100;
  private boostMax = 100;
  private boostActive = false;
  private nitroActive = 0; // seconds remaining of pickup-driven nitro
  private megaActive = 0; // seconds of mega smash
  private magnetActive = 0;
  private invuln = 0;
  private slowMo = 0;
  private hitFlash = 0;
  private smashMultiplier = 1.0;
  private status: GameStatus = "idle";
  private upgrades: Upgrades = { bumper: 0, engine: 0, nitroTank: 0, explosive: 0, paint: 0, car: 0 };
  private startTime = 0;
  private elapsed = 0;
  private newHighFlag = false;
  private bestScoreAtStart = 0;

  // World
  private segments: HighwaySegment[] = [];
  private nextSegmentZ = 0;
  private firstSegmentZ = 0;
  private cityProps: THREE.Object3D[] = [];

  // Entities
  private traffic: TrafficCar[] = [];
  private debris: DebrisPiece[] = [];
  private particles: Particle[] = [];
  private powers: PowerPickup[] = [];
  private scraps: ScrapPickup[] = [];
  private barriers: Barrier[] = [];
  private trafficSpawnZ = 60;
  private powerSpawnZ = 200;
  private barrierSpawnZ = 300;

  // Input
  private keys: Record<string, boolean> = {};
  private mobileSteer = 0; // -1..1
  private mobileBoost = false;
  private mobilePower = false;

  // Camera shake
  private shakeAmount = 0;

  // Animation
  private rafId: number | null = null;
  private resizeObs?: ResizeObserver;

  private sound: SoundEngine;

  constructor(container: HTMLElement, sound: SoundEngine, callbacks: GameCallbacks) {
    this.container = container;
    this.sound = sound;
    this.callbacks = callbacks;

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      console.error("WebGL init failed:", err);
      // Graceful fallback message in the container
      const msg = document.createElement("div");
      msg.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;text-align:center;padding:24px;";
      msg.innerHTML = `<div><h2 style="color:#ff2bd6;margin:0 0 12px">WebGL not available</h2><p style="opacity:.7">This browser/device does not support WebGL.<br/>Try Chrome, Firefox or Edge with hardware acceleration enabled.</p></div>`;
      container.appendChild(msg);
      throw err;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const rect = container.getBoundingClientRect();
    this.renderer.setSize(rect.width || window.innerWidth, rect.height || window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x0a0612, 1);
    this.renderer.domElement.classList.add("game-canvas");
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x2a0a3a, 60, 320);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x1a0826);

    const aspect = (rect.width || window.innerWidth) / (rect.height || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.5, 600);
    this.camera.position.set(0, 7.5, -12);
    this.camera.lookAt(0, 1.6, 12);

    this.setupLights();
    this.bindInput();
    this.bindResize();
  }

  // ------- public API -------
  setUpgrades(u: Upgrades) {
    this.upgrades = u;
  }

  start(upgrades: Upgrades, scrapBank: number, bestScore: number) {
    this.upgrades = upgrades;
    this.bestScoreAtStart = bestScore;
    this.scrap = scrapBank; // running total displayed = bank + earned this run
    this.resetWorld();
    this.spawnPlayer();
    this.applyUpgradeStats();
    this.status = "playing";
    this.callbacks.onStatus(this.status);
    this.startTime = performance.now();
    this.clock.start();
    this.sound.startEngine();
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  pause() {
    if (this.status === "playing") {
      this.status = "paused";
      this.callbacks.onStatus(this.status);
      this.sound.setEngineParams(0, 0);
    }
  }

  resume() {
    if (this.status === "paused") {
      this.status = "playing";
      this.callbacks.onStatus(this.status);
      this.clock.getDelta(); // discard accumulated
    }
  }

  endRun() {
    if (this.status === "gameover") return;
    this.status = "gameover";
    this.callbacks.onStatus(this.status);
    this.sound.stopEngine();
    const result: RunResult = {
      distance: Math.floor(this.playerZ),
      score: Math.floor(this.score),
      scrap: this.runScrapEarned(),
      newHighScore: this.score > this.bestScoreAtStart,
      bestChain: this.bestChain,
    };
    this.callbacks.onRunEnd(result);
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.resizeObs?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.sound.stopEngine();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // mobile control hooks
  setMobileSteer(v: number) {
    this.mobileSteer = clamp(v, -1, 1);
  }
  setMobileBoost(v: boolean) {
    this.mobileBoost = v;
  }
  setMobilePower(v: boolean) {
    this.mobilePower = v;
  }

  triggerPower() {
    // No-op placeholder — power consumed automatically by pickup, kept for future use.
  }

  // -------- Setup --------
  private setupLights() {
    this.ambient = new THREE.AmbientLight(0x6644aa, 0.55);
    this.scene.add(this.ambient);

    this.dirLight = new THREE.DirectionalLight(0xffaa66, 0.9);
    this.dirLight.position.set(40, 60, 30);
    this.scene.add(this.dirLight);

    // Hemisphere - dusk feel
    const hemi = new THREE.HemisphereLight(0xff77cc, 0x110022, 0.5);
    this.scene.add(hemi);
  }

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (this.status === "playing" && (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight")) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private bindResize() {
    const handle = () => {
      const rect = this.container.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handle);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObs = new ResizeObserver(handle);
      this.resizeObs.observe(this.container);
    }
  }

  // -------- World reset --------
  private resetWorld() {
    // remove old entities
    for (const t of this.traffic) this.scene.remove(t.parts.group);
    this.traffic.length = 0;
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris.length = 0;
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles.length = 0;
    for (const p of this.powers) this.scene.remove(p.group);
    this.powers.length = 0;
    for (const s of this.scraps) this.scene.remove(s.mesh);
    this.scraps.length = 0;
    for (const b of this.barriers) this.scene.remove(b.mesh);
    this.barriers.length = 0;
    for (const seg of this.segments) this.scene.remove(seg.group);
    this.segments.length = 0;
    for (const p of this.cityProps) this.scene.remove(p);
    this.cityProps.length = 0;

    // Reset state
    this.playerX = 0;
    this.playerZ = 0;
    this.targetX = 0;
    this.steerVel = 0;
    this.playerSpeed = 22;
    this.score = 0;
    this.chainCount = 0;
    this.chainTimer = 0;
    this.bestChain = 0;
    this.boost = this.boostMax;
    this.nitroActive = 0;
    this.megaActive = 0;
    this.magnetActive = 0;
    this.invuln = 1.0; // brief grace period
    this.slowMo = 0;
    this.hitFlash = 0;
    this.smashMultiplier = 1.0;
    this.elapsed = 0;
    this.newHighFlag = false;
    this.trafficSpawnZ = 80;
    this.powerSpawnZ = 200;
    this.barrierSpawnZ = 350;
    this.firstSegmentZ = -SEGMENT_LENGTH * 2;
    this.nextSegmentZ = this.firstSegmentZ;

    // Build initial highway segments
    for (let i = 0; i < VISIBLE_AHEAD + VISIBLE_BEHIND; i++) {
      this.spawnSegment();
    }
  }

  private applyUpgradeStats() {
    const tier = CAR_TIERS[this.upgrades.car] ?? CAR_TIERS[0]!;
    this.playerCarTier = tier;
    this.maxHealth = tier.baseHealth + this.upgrades.bumper * 25;
    this.health = this.maxHealth;
    this.boostMax = 100 + this.upgrades.nitroTank * 35;
    this.boost = this.boostMax;
    this.maxSpeed = 78 + this.upgrades.engine * 6;
    this.smashMultiplier = tier.baseSmash * (1 + this.upgrades.bumper * 0.12 + this.upgrades.explosive * 0.08);
  }

  private spawnPlayer() {
    if (this.playerGroup) {
      this.scene.remove(this.playerGroup);
    }
    const tier = CAR_TIERS[this.upgrades.car] ?? CAR_TIERS[0]!;
    const color = PAINT_COLORS[this.upgrades.paint] ?? PAINT_COLORS[0]!;
    const parts = buildCarMesh({
      color,
      width: tier.width,
      length: tier.length,
      height: tier.height,
      isTruck: tier.isTruck,
      isMonster: tier.isMonster,
    });
    this.playerParts = parts;
    this.playerHalfW = tier.width / 2;
    this.playerHalfL = tier.length / 2;
    this.playerGroup = parts.group;
    this.scene.add(this.playerGroup);
    this.playerGroup.position.set(0, 0, 0);
  }

  // -------- Highway segment generation --------
  private spawnSegment() {
    const grp = new THREE.Group();
    const z = this.nextSegmentZ;

    // Road surface
    const roadGeom = new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, SEGMENT_LENGTH);
    const cracked = Math.random() < 0.6;
    const roadMat = new THREE.MeshStandardMaterial({
      color: cracked ? 0x1c1c22 : 0x222230,
      roughness: 0.95,
      metalness: 0.05,
      emissive: 0x110011,
      emissiveIntensity: 0.15,
    });
    const road = new THREE.Mesh(roadGeom, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, z + SEGMENT_LENGTH / 2);
    grp.add(road);

    // Lane stripes (3 dashed)
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffd400,
      emissive: 0xffd400,
      emissiveIntensity: 0.6,
    });
    const dashCount = 8;
    for (let lane = 0; lane < 3; lane++) {
      const xPos = -ROAD_HALF_WIDTH + (ROAD_HALF_WIDTH * 2 * (lane + 1)) / 4;
      for (let d = 0; d < dashCount; d++) {
        const dashGeom = new THREE.PlaneGeometry(0.18, 2.2);
        const dash = new THREE.Mesh(dashGeom, stripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(
          xPos,
          0.02,
          z + (d + 0.5) * (SEGMENT_LENGTH / dashCount),
        );
        grp.add(dash);
      }
    }

    // Side curbs (neon edges)
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xff2bd6,
      emissive: 0xff2bd6,
      emissiveIntensity: 1.2,
    });
    const curbGeom = new THREE.BoxGeometry(0.4, 0.25, SEGMENT_LENGTH);
    const curbL = new THREE.Mesh(curbGeom, curbMat);
    curbL.position.set(-ROAD_HALF_WIDTH - 0.2, 0.12, z + SEGMENT_LENGTH / 2);
    grp.add(curbL);
    const curbR = new THREE.Mesh(curbGeom, curbMat);
    curbR.position.set(ROAD_HALF_WIDTH + 0.2, 0.12, z + SEGMENT_LENGTH / 2);
    grp.add(curbR);

    // Sidewalk strip
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x18121e, roughness: 0.9 });
    const sidewalkGeom = new THREE.PlaneGeometry(4, SEGMENT_LENGTH);
    const swL = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    swL.rotation.x = -Math.PI / 2;
    swL.position.set(-ROAD_HALF_WIDTH - 2.4, 0.0, z + SEGMENT_LENGTH / 2);
    grp.add(swL);
    const swR = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    swR.rotation.x = -Math.PI / 2;
    swR.position.set(ROAD_HALF_WIDTH + 2.4, 0.0, z + SEGMENT_LENGTH / 2);
    grp.add(swR);

    // Procedural city skyline buildings on each side
    const decorations: THREE.Object3D[] = [];
    for (let side = -1; side <= 1; side += 2) {
      const bcount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < bcount; i++) {
        const bw = rand(4, 9);
        const bh = rand(8, 28);
        const bd = rand(4, 9);
        const colorRoll = Math.random();
        const baseColor = colorRoll < 0.5 ? 0x2a1640 : colorRoll < 0.85 ? 0x402244 : 0x1a2244;
        const bMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.85,
          metalness: 0.2,
          emissive: pick([0xff2bd6, 0x00f0ff, 0xffd400, 0xff7a00]),
          emissiveIntensity: 0.05,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bMat);
        const xOff = side * (ROAD_HALF_WIDTH + 6 + Math.random() * 18);
        b.position.set(xOff, bh / 2, z + Math.random() * SEGMENT_LENGTH);
        grp.add(b);
        decorations.push(b);

        // Add neon billboard (random)
        if (Math.random() < 0.35) {
          const bbColor = pick([0xff2bd6, 0x00f0ff, 0xffd400, 0xff4422, 0x66ff66]);
          const bbMat = new THREE.MeshStandardMaterial({
            color: bbColor,
            emissive: bbColor,
            emissiveIntensity: 1.6,
          });
          const bbGeom = new THREE.BoxGeometry(rand(2.5, 5.5), rand(1.2, 2.6), 0.2);
          const bb = new THREE.Mesh(bbGeom, bbMat);
          bb.position.set(
            xOff - side * (bw / 2 + 0.15),
            rand(bh * 0.3, bh * 0.85),
            z + Math.random() * SEGMENT_LENGTH,
          );
          bb.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          grp.add(bb);
          decorations.push(bb);
        }
      }

      // Streetlight
      if (Math.random() < 0.6) {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.7 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
        pole.position.set(side * (ROAD_HALF_WIDTH + 1), 3, z + Math.random() * SEGMENT_LENGTH);
        grp.add(pole);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffeebb,
          emissive: 0xffeebb,
          emissiveIntensity: 1.4,
        });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lampMat);
        lamp.position.set(side * (ROAD_HALF_WIDTH + 0.4), 5.6, pole.position.z);
        grp.add(lamp);
        decorations.push(pole);
        decorations.push(lamp);
      }

      // Wrecked abandoned car on shoulder (decoration)
      if (Math.random() < 0.18) {
        const wreck = buildCarMesh({
          color: pick([0x444444, 0x222233, 0x553322]),
          width: 1.9,
          length: 4.2,
          height: 0.95,
          isTruck: false,
          isMonster: false,
        });
        wreck.group.position.set(
          side * (ROAD_HALF_WIDTH + 2.4),
          0,
          z + rand(2, SEGMENT_LENGTH - 2),
        );
        wreck.group.rotation.y = rand(-0.5, 0.5) + Math.PI;
        wreck.group.rotation.z = rand(-0.1, 0.1);
        grp.add(wreck.group);
        decorations.push(wreck.group);
      }
    }

    this.scene.add(grp);
    this.segments.push({ group: grp, startZ: z, endZ: z + SEGMENT_LENGTH, decorations });
    this.nextSegmentZ += SEGMENT_LENGTH;
  }

  private recycleSegments() {
    while (this.segments.length > 0 && this.segments[0]!.endZ < this.playerZ - VISIBLE_BEHIND * SEGMENT_LENGTH) {
      const old = this.segments.shift()!;
      this.scene.remove(old.group);
      // Free geometries / materials
      old.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
      this.spawnSegment();
    }
  }

  // -------- Traffic spawning --------
  private spawnTrafficUntil(targetZ: number) {
    const distFactor = Math.min(1, this.playerZ / 4000);
    while (this.trafficSpawnZ < targetZ) {
      // Random gap between groups
      const groupGap = rand(11, 30) - distFactor * 5;
      this.trafficSpawnZ += groupGap;

      // Choose a random subset of lanes
      const laneIndices = [0, 1, 2, 3];
      // Shuffle
      for (let i = laneIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [laneIndices[i], laneIndices[j]] = [laneIndices[j]!, laneIndices[i]!];
      }
      const numCars = Math.min(
        4,
        1 + Math.floor(Math.random() * (2 + Math.floor(distFactor * 3))),
      );
      const usedLanes = laneIndices.slice(0, numCars);
      for (const laneIdx of usedLanes) {
        // Skip occasionally to avoid impossible jams
        if (Math.random() < 0.12) continue;
        const isLarge = Math.random() < 0.18 + distFactor * 0.07;
        this.spawnTrafficCar(laneIdx, this.trafficSpawnZ + rand(-2, 2), isLarge);
      }
    }
  }

  private spawnTrafficCar(laneIdx: number, z: number, isLarge: boolean) {
    const colorOptions = [0x2a3040, 0x553344, 0x335566, 0x664422, 0x442266, 0x224477, 0x554422, 0x553300];
    const color = pick(colorOptions);
    const width = isLarge ? rand(2.4, 2.8) : rand(1.85, 2.05);
    const length = isLarge ? rand(7.5, 10) : rand(4.0, 4.8);
    const height = isLarge ? 2.4 : 1.0;
    const parts = buildCarMesh({
      color,
      width,
      length,
      height,
      isTruck: isLarge,
      isMonster: false,
    });
    const lx = LANE_X[laneIdx]!;
    parts.group.position.set(lx, 0, z);
    parts.group.rotation.y = Math.PI; // facing player (towards -z = towards camera)
    this.scene.add(parts.group);

    // Traffic moves opposite direction (toward player) for satisfying head-ons,
    // but slower than player so chases also feel good. Mix of directions:
    const goingTowardsPlayer = Math.random() < 0.62;
    const baseSpeed = isLarge ? rand(8, 16) : rand(12, 22);
    const vz = goingTowardsPlayer ? -baseSpeed : baseSpeed * 0.5;
    if (!goingTowardsPlayer) parts.group.rotation.y = 0;

    const car: TrafficCar = {
      parts,
      laneIdx,
      position: parts.group.position,
      velocity: new THREE.Vector3(0, 0, vz),
      width,
      length,
      alive: true,
      health: isLarge ? 70 : 35,
      isLarge,
      swayPhase: Math.random() * Math.PI * 2,
      swerveBias: rand(-0.6, 0.6),
    };
    this.traffic.push(car);
  }

  // -------- Power-up spawning --------
  private spawnPowersUntil(targetZ: number) {
    while (this.powerSpawnZ < targetZ) {
      this.powerSpawnZ += rand(120, 220);
      const kinds: PowerKind[] = ["nitro", "magnet", "repair", "mega"];
      const kind = pick(kinds);
      const lane = Math.floor(Math.random() * LANE_X.length);
      this.spawnPower(LANE_X[lane]!, this.powerSpawnZ, kind);
    }
  }

  private spawnPower(x: number, z: number, kind: PowerKind) {
    const grp = new THREE.Group();
    const colorMap: Record<PowerKind, number> = {
      nitro: 0x00f0ff,
      magnet: 0xff2bd6,
      repair: 0x5eff7c,
      mega: 0xffd400,
    };
    const color = colorMap[kind];
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.6,
      metalness: 0.3,
      roughness: 0.3,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat);
    grp.add(core);
    // Ring
    const ringMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 6, 18), ringMat);
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);

    grp.position.set(x, 1.4, z);
    this.scene.add(grp);
    this.powers.push({
      group: grp,
      position: grp.position,
      kind,
      alive: true,
      spinPhase: Math.random() * Math.PI * 2,
    });
  }

  // -------- Barrier (destructible) spawning --------
  private spawnBarriersUntil(targetZ: number) {
    while (this.barrierSpawnZ < targetZ) {
      this.barrierSpawnZ += rand(180, 320);
      // 1-2 barriers in random lanes
      const count = Math.random() < 0.4 ? 2 : 1;
      const lanes = [0, 1, 2, 3];
      for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j]!, lanes[i]!];
      }
      for (let i = 0; i < count; i++) {
        const li = lanes[i]!;
        this.spawnBarrier(LANE_X[li]!, this.barrierSpawnZ);
      }
    }
  }

  private spawnBarrier(x: number, z: number) {
    const isOilDrum = Math.random() < 0.55;
    if (isOilDrum) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        emissive: 0xff3300,
        emissiveIntensity: 0.6,
        roughness: 0.6,
      });
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 12), mat);
      drum.position.set(x, 0.65, z);
      this.scene.add(drum);
      this.barriers.push({
        mesh: drum,
        position: drum.position,
        width: 1.1,
        length: 1.1,
        alive: true,
        health: 1,
      });
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffaa22,
        emissive: 0xff4400,
        emissiveIntensity: 0.4,
        roughness: 0.7,
      });
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.0), mat);
      block.position.set(x, 0.5, z);
      this.scene.add(block);
      this.barriers.push({
        mesh: block,
        position: block.position,
        width: 1.6,
        length: 1.0,
        alive: true,
        health: 2,
      });
    }
  }

  // ===================================================================
  // Main loop
  // ===================================================================
  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    let dt = this.clock.getDelta();
    if (dt > 0.08) dt = 0.08; // cap to prevent huge steps after tab switch
    if (this.status === "playing") {
      this.updatePlaying(dt);
    } else if (this.status === "paused") {
      // No update; just render
    } else if (this.status === "gameover") {
      // Slow drifting world while screen up
      this.updatePostGame(dt);
    } else {
      this.updateIdle(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private updateIdle(dt: number) {
    // Slow camera orbit on menu
    this.elapsed += dt;
    const r = 18;
    this.camera.position.x = Math.sin(this.elapsed * 0.25) * r;
    this.camera.position.z = -12 + Math.cos(this.elapsed * 0.25) * 5;
    this.camera.position.y = 8;
    this.camera.lookAt(0, 1.5, 8);
  }

  private updatePostGame(dt: number) {
    this.elapsed += dt;
    // Slowly orbit + raise camera
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 14, dt * 1.4);
    this.camera.position.x = Math.sin(this.elapsed * 0.4) * 7;
    this.camera.lookAt(this.playerGroup.position.x, 1.5, this.playerGroup.position.z);
    // Update particles & debris
    this.updateDebris(dt * 0.4);
    this.updateParticles(dt * 0.4);
  }

  private updatePlaying(dt: number) {
    this.elapsed += dt;
    // ----- Input -----
    let steerInput = 0;
    if (this.keys["ArrowLeft"] || this.keys["KeyA"]) steerInput -= 1;
    if (this.keys["ArrowRight"] || this.keys["KeyD"]) steerInput += 1;
    steerInput += this.mobileSteer;
    steerInput = clamp(steerInput, -1, 1);
    let boostHeld = !!(this.keys["Space"] || this.keys["ShiftLeft"] || this.keys["ShiftRight"] || this.mobileBoost);

    // ----- Slow-mo factor -----
    const slowFactor = this.slowMo > 0 ? 0.4 : 1;
    const sdt = dt * slowFactor;
    if (this.slowMo > 0) this.slowMo -= dt;

    // ----- Boost / nitro -----
    let speedBoostMul = 1;
    if (boostHeld && this.boost > 5) {
      this.boost = Math.max(0, this.boost - 28 * dt);
      speedBoostMul = 1.55;
      this.boostActive = true;
    } else {
      this.boostActive = false;
      // Regen
      this.boost = Math.min(this.boostMax, this.boost + 11 * dt);
    }
    if (this.nitroActive > 0) {
      this.nitroActive -= dt;
      speedBoostMul = Math.max(speedBoostMul, 1.85);
    }

    // ----- Player physics -----
    const targetSpeed = (this.maxSpeed) * speedBoostMul;
    // Auto-acceleration ramp with distance
    const distRamp = Math.min(1.4, 1 + this.playerZ / 8000);
    this.playerSpeed = THREE.MathUtils.damp(
      this.playerSpeed,
      Math.min(targetSpeed, 22 * distRamp + this.maxSpeed * 0.55 * speedBoostMul + 18 * (this.boostActive ? 1 : 0)),
      2.5,
      sdt,
    );
    this.playerSpeed = clamp(this.playerSpeed, 16, 130);

    this.playerZ += this.playerSpeed * sdt;
    this.playerGroup.position.z = this.playerZ;

    // Steering: target lateral velocity
    const steerAccel = 38 + this.upgrades.engine * 2.5;
    this.steerVel += steerInput * steerAccel * sdt;
    // Friction
    this.steerVel *= Math.pow(0.0007, sdt);
    this.steerVel = clamp(this.steerVel, -16, 16);
    this.playerX += this.steerVel * sdt;
    // Clamp to road
    const maxX = ROAD_HALF_WIDTH - this.playerHalfW + 0.4;
    if (this.playerX > maxX) {
      this.playerX = maxX;
      this.steerVel = Math.min(0, this.steerVel) * 0.4;
    } else if (this.playerX < -maxX) {
      this.playerX = -maxX;
      this.steerVel = Math.max(0, this.steerVel) * 0.4;
    }
    this.playerGroup.position.x = this.playerX;
    // Tilt / lean
    const leanRoll = clamp(-this.steerVel / 14, -0.35, 0.35);
    this.playerGroup.rotation.z = THREE.MathUtils.damp(this.playerGroup.rotation.z, leanRoll, 8, sdt);
    this.playerGroup.rotation.y = THREE.MathUtils.damp(
      this.playerGroup.rotation.y,
      clamp(-this.steerVel / 30, -0.18, 0.18),
      8,
      sdt,
    );

    // ----- Mega smash size -----
    const megaScale = this.megaActive > 0 ? 1.6 : 1;
    this.playerGroup.scale.setScalar(THREE.MathUtils.damp(this.playerGroup.scale.x, megaScale, 6, sdt));
    if (this.megaActive > 0) this.megaActive -= dt;

    // ----- Magnet -----
    if (this.magnetActive > 0) this.magnetActive -= dt;

    // ----- Invuln decay -----
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // ----- World streaming -----
    this.recycleSegments();
    while (this.nextSegmentZ < this.playerZ + VISIBLE_AHEAD * SEGMENT_LENGTH) {
      this.spawnSegment();
    }
    this.spawnTrafficUntil(this.playerZ + TRAFFIC_AHEAD);
    this.spawnPowersUntil(this.playerZ + 280);
    this.spawnBarriersUntil(this.playerZ + 360);

    // ----- Update traffic -----
    this.updateTraffic(sdt);
    this.updateScraps(sdt);
    this.updatePowers(sdt);
    this.updateBarriers(sdt);
    this.updateDebris(sdt);
    this.updateParticles(sdt);

    // ----- Collisions -----
    this.checkCollisions();

    // ----- Score / chain timer -----
    this.score += this.playerSpeed * sdt * 0.9; // distance points
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) {
        if (this.chainCount > this.bestChain) this.bestChain = this.chainCount;
        this.chainCount = 0;
      }
    }

    // ----- Camera follow with shake -----
    const camTargetY = 6.5 + (this.megaActive > 0 ? 2.5 : 0);
    const camBackZ = -10 - (this.boostActive || this.nitroActive > 0 ? 2 : 0);
    const camTargetX = this.playerX * 0.55;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camTargetX, 4, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camTargetY, 4, dt);
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      this.playerZ + camBackZ,
      6,
      dt,
    );
    if (this.shakeAmount > 0.0001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= Math.pow(0.0008, dt);
    } else {
      this.shakeAmount = 0;
    }
    this.camera.lookAt(this.playerX, 1.6, this.playerZ + 18);

    // ----- Engine sound -----
    const speed01 = clamp(this.playerSpeed / 130, 0, 1);
    this.sound.setEngineParams(speed01, this.boostActive || this.nitroActive > 0 ? 1 : 0);

    // ----- HUD -----
    const activePower = this.computeActivePower();
    this.callbacks.onHud({
      distance: Math.floor(this.playerZ),
      score: Math.floor(this.score),
      multiplier: this.computeMultiplier(),
      health: this.health,
      maxHealth: this.maxHealth,
      scrap: this.scrap,
      boost: this.boost,
      boostMax: this.boostMax,
      speedKmh: Math.floor(this.playerSpeed * 3.6),
      activePower,
      status: this.status,
    });
  }

  private computeMultiplier() {
    return Math.max(1, this.chainCount > 0 ? this.chainCount : 1);
  }

  private computeActivePower(): ActivePower | null {
    if (this.megaActive > 0) return { kind: "mega", remaining: this.megaActive, duration: 6 };
    if (this.nitroActive > 0) return { kind: "nitro", remaining: this.nitroActive, duration: 4 };
    if (this.magnetActive > 0) return { kind: "magnet", remaining: this.magnetActive, duration: 8 };
    return null;
  }

  private runScrapEarned(): number {
    return this.scrap; // includes prior bank for display; the controller diffs externally
  }

  // -------- Traffic update / AI --------
  private updateTraffic(dt: number) {
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i]!;
      // Position update
      t.position.z += t.velocity.z * dt;
      // Lateral sway / mild swerve
      t.swayPhase += dt * 1.8;
      const targetX = LANE_X[t.laneIdx]! + Math.sin(t.swayPhase) * 0.15 + t.swerveBias * 0.0;
      t.position.x = THREE.MathUtils.damp(t.position.x, targetX, 4, dt);

      // Recycle if far behind player
      if (t.position.z < this.playerZ - 60 || t.position.z > this.playerZ + TRAFFIC_AHEAD + 60) {
        this.scene.remove(t.parts.group);
        this.disposeCarParts(t.parts);
        this.traffic.splice(i, 1);
      }
    }
  }

  private updatePowers(dt: number) {
    for (let i = this.powers.length - 1; i >= 0; i--) {
      const p = this.powers[i]!;
      p.spinPhase += dt;
      p.group.rotation.y += dt * 1.8;
      p.group.position.y = 1.4 + Math.sin(p.spinPhase * 2.2) * 0.25;
      if (p.position.z < this.playerZ - 30 || !p.alive) {
        this.scene.remove(p.group);
        this.powers.splice(i, 1);
      }
    }
  }

  private updateBarriers(dt: number) {
    for (let i = this.barriers.length - 1; i >= 0; i--) {
      const b = this.barriers[i]!;
      if (!b.alive || b.position.z < this.playerZ - 30) {
        this.scene.remove(b.mesh);
        this.barriers.splice(i, 1);
      }
    }
    void dt;
  }

  private updateScraps(dt: number) {
    for (let i = this.scraps.length - 1; i >= 0; i--) {
      const s = this.scraps[i]!;
      s.age += dt;
      // Magnet pull
      const dx = this.playerX - s.position.x;
      const dz = this.playerZ - s.position.z;
      const dist = Math.hypot(dx, dz);
      const magnetRange = this.magnetActive > 0 ? 22 : 5;
      if (dist < magnetRange) {
        const pullStrength = this.magnetActive > 0 ? 60 : 18;
        const f = pullStrength / Math.max(1.5, dist);
        s.velocity.x += (dx / Math.max(0.001, dist)) * f * dt;
        s.velocity.z += (dz / Math.max(0.001, dist)) * f * dt;
      }
      // Apply gravity / damping
      s.velocity.y -= 18 * dt;
      s.velocity.x *= Math.pow(0.18, dt);
      s.velocity.z = THREE.MathUtils.lerp(s.velocity.z, this.playerSpeed * 0.6, 0.25 * dt);
      s.position.addScaledVector(s.velocity, dt);
      if (s.position.y < 0.3) {
        s.position.y = 0.3;
        s.velocity.y *= -0.4;
      }
      s.mesh.rotation.x += dt * 4;
      s.mesh.rotation.y += dt * 5;
      // Pickup if close to player
      if (dist < 2.5 && Math.abs(s.position.y - 1) < 2) {
        this.scrap += s.value;
        this.score += s.value * 5;
        this.callbacks.onFloatingScore(`+${s.value} scrap`, "#5eff7c");
        this.sound.pickup(1 + Math.random() * 0.4);
        this.scene.remove(s.mesh);
        s.alive = false;
      }
      if (!s.alive || s.age > 12 || s.position.z < this.playerZ - 25) {
        if (s.alive) this.scene.remove(s.mesh);
        this.scraps.splice(i, 1);
      }
    }
  }

  private updateDebris(dt: number) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!;
      d.life -= dt;
      d.velocity.y -= 28 * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.angularVelocity.x * dt;
      d.mesh.rotation.y += d.angularVelocity.y * dt;
      d.mesh.rotation.z += d.angularVelocity.z * dt;
      if (d.mesh.position.y < 0.2) {
        d.mesh.position.y = 0.2;
        d.velocity.y *= -0.35;
        d.velocity.x *= 0.6;
        d.velocity.z *= 0.7;
      }
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        (d.mesh.material as THREE.Material).dispose();
        this.debris.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(Math.pow(0.05, dt));
      p.velocity.y += 4 * dt; // smoke rises
      const s = clamp(p.life / p.maxLife, 0, 1);
      p.mesh.scale.setScalar(s * p.shrink);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = s * 0.95;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // -------- Collision detection --------
  private checkCollisions() {
    const px = this.playerX;
    const pz = this.playerZ;
    const phw = this.playerHalfW * (this.megaActive > 0 ? 1.6 : 1);
    const phl = this.playerHalfL * (this.megaActive > 0 ? 1.6 : 1);

    // Traffic collisions (smash!)
    for (const t of this.traffic) {
      if (!t.alive) continue;
      const tx = t.position.x;
      const tz = t.position.z;
      const thw = t.width / 2;
      const thl = t.length / 2;
      if (
        Math.abs(px - tx) < phw + thw - 0.05 &&
        Math.abs(pz - tz) < phl + thl - 0.05
      ) {
        this.onTrafficSmash(t);
      }
    }

    // Power-up pickups
    for (const p of this.powers) {
      if (!p.alive) continue;
      if (Math.abs(px - p.position.x) < phw + 1.4 && Math.abs(pz - p.position.z) < phl + 1.4) {
        this.onPowerCollect(p);
      }
    }

    // Barrier collisions
    for (const b of this.barriers) {
      if (!b.alive) continue;
      if (
        Math.abs(px - b.position.x) < phw + b.width / 2 - 0.05 &&
        Math.abs(pz - b.position.z) < phl + b.length / 2 - 0.05
      ) {
        this.onBarrierSmash(b);
      }
    }
  }

  private onTrafficSmash(t: TrafficCar) {
    if (!t.alive) return;
    const isMega = this.megaActive > 0;
    const damageDealt = (isMega ? 1000 : 50) * this.smashMultiplier;
    t.health -= damageDealt;

    // Damage to player (less if mega)
    let dmgToPlayer = (t.isLarge ? 18 : 10);
    if (this.invuln > 0 || isMega) dmgToPlayer = 0;
    // Bumper upgrade reduces damage
    dmgToPlayer = dmgToPlayer * (1 - this.upgrades.bumper * 0.08);
    if (dmgToPlayer > 0) {
      this.health = Math.max(0, this.health - dmgToPlayer);
      this.invuln = 0.35;
      this.hitFlash = 0.18;
      this.shakeAmount += 0.6;
      this.callbacks.onShake(0.6);
      this.sound.crash(0.6);
      // Damage car visually
      this.applyPlayerDamageVisual();
    }

    if (t.health <= 0) {
      this.destroyTrafficCar(t, isMega ? 1.4 : 1.0);
    } else {
      // Glancing hit -> spawn small debris
      this.spawnDebris(t.position, t.isLarge ? 6 : 3, 0xaaaaaa, 0.6);
      this.sound.crash(0.3);
    }

    // Death check
    if (this.health <= 0) {
      this.killPlayer();
    }
  }

  private onBarrierSmash(b: Barrier) {
    if (!b.alive) return;
    b.health -= 1;
    if (b.health <= 0) {
      this.scene.remove(b.mesh);
      b.alive = false;
      // Explode + damage radius vs nearby traffic
      const explosionPos = b.position.clone();
      this.spawnExplosion(explosionPos, 1.0);
      this.applyExplosionDamage(explosionPos, 7 + this.upgrades.explosive * 1.4);
      this.sound.explosion(0.8);
      this.score += 80 + this.upgrades.explosive * 10;
      this.callbacks.onFloatingScore(`+${80 + this.upgrades.explosive * 10}`, "#ffd400");
      this.shakeAmount += 0.8;
      this.callbacks.onShake(0.8);
    } else {
      this.sound.crash(0.5);
      this.spawnDebris(b.position, 4, 0xff7733, 0.4);
    }
    // Tiny health loss from impact
    this.health = Math.max(0, this.health - 4 * (1 - this.upgrades.bumper * 0.08));
    if (this.health <= 0) this.killPlayer();
  }

  private destroyTrafficCar(t: TrafficCar, multiplier: number) {
    if (!t.alive) return;
    t.alive = false;
    this.scene.remove(t.parts.group);
    this.disposeCarParts(t.parts);

    // Explosion
    const pos = t.position.clone();
    pos.y = 1;
    const power = (t.isLarge ? 1.4 : 0.9) * multiplier;
    this.spawnExplosion(pos, power);
    this.sound.explosion(0.55 + power * 0.4);

    // Score & chain
    this.chainCount += 1;
    this.chainTimer = 1.6;
    if (this.chainCount > this.bestChain) this.bestChain = this.chainCount;
    const baseScore = (t.isLarge ? 220 : 120) * this.smashMultiplier;
    const chainBonus = Math.pow(this.chainCount, 1.35);
    const gain = Math.floor(baseScore * chainBonus * multiplier);
    this.score += gain;
    this.callbacks.onFloatingScore(
      this.chainCount >= 2 ? `x${this.chainCount} CHAIN! +${gain}` : `+${gain}`,
      this.chainCount >= 5 ? "#ff2bd6" : this.chainCount >= 2 ? "#ffd400" : "#ffffff",
    );

    // Big chain effects
    if (this.chainCount >= 5) {
      this.slowMo = 0.55;
      this.shakeAmount += 1.2;
      this.callbacks.onShake(1.2);
      this.callbacks.onChainEvent(this.chainCount);
    } else if (this.chainCount >= 3) {
      this.shakeAmount += 0.5;
      this.callbacks.onShake(0.5);
      this.callbacks.onChainEvent(this.chainCount);
    }

    // Debris fragments
    this.spawnDebris(pos, t.isLarge ? 14 : 8, t.parts.body.material instanceof THREE.MeshStandardMaterial ? (t.parts.body.material.color.getHex()) : 0x888888, 1.0);

    // Drop scrap
    const scrapCount = Math.floor((t.isLarge ? 4 : 2) + Math.random() * 3);
    for (let i = 0; i < scrapCount; i++) {
      this.spawnScrap(pos, t.isLarge ? 3 : 1);
    }

    // Chain reaction: damage neighbors within radius
    const radius = (t.isLarge ? 7 : 5) + this.upgrades.explosive * 1.2;
    this.applyExplosionDamage(pos, radius);
  }

  private applyExplosionDamage(center: THREE.Vector3, radius: number) {
    for (const other of this.traffic) {
      if (!other.alive) continue;
      const dx = other.position.x - center.x;
      const dz = other.position.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        const dmg = (radius - d) * 22;
        other.health -= dmg;
        if (other.health <= 0) {
          // Slight delay illusion via slight pos randomization, but instant chain
          this.destroyTrafficCar(other, 1);
        } else {
          // Knock visually
          other.parts.group.rotation.z += rand(-0.2, 0.2);
          // Visual scuff
          if (other.parts.body.material instanceof THREE.MeshStandardMaterial) {
            other.parts.body.material.color.lerp(new THREE.Color(0x222222), 0.15);
          }
        }
      }
    }
    for (const b of this.barriers) {
      if (!b.alive) continue;
      const dx = b.position.x - center.x;
      const dz = b.position.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d < radius * 0.9) {
        b.health = 0;
        this.onBarrierSmash(b);
      }
    }
  }

  private onPowerCollect(p: PowerPickup) {
    p.alive = false;
    this.sound.powerup();
    switch (p.kind) {
      case "nitro":
        this.nitroActive = 4;
        this.boost = this.boostMax;
        this.sound.nitro();
        this.callbacks.onFloatingScore("NITRO!", "#00f0ff");
        this.score += 150;
        break;
      case "magnet":
        this.magnetActive = 8;
        this.callbacks.onFloatingScore("MAGNET!", "#ff2bd6");
        this.score += 100;
        break;
      case "repair":
        this.health = Math.min(this.maxHealth, this.health + 45);
        this.callbacks.onFloatingScore("+REPAIR", "#5eff7c");
        this.score += 80;
        break;
      case "mega":
        this.megaActive = 6;
        this.callbacks.onFloatingScore("MEGA SMASH!", "#ffd400");
        this.score += 250;
        this.shakeAmount += 0.8;
        this.callbacks.onShake(0.8);
        break;
    }
  }

  private killPlayer() {
    if (this.status !== "playing") return;
    // Massive boom
    this.spawnExplosion(this.playerGroup.position.clone().add(new THREE.Vector3(0, 1, 0)), 2.4);
    this.sound.explosion(1.4);
    this.shakeAmount += 2.5;
    this.callbacks.onShake(2.5);
    this.spawnDebris(this.playerGroup.position, 30, PAINT_COLORS[this.upgrades.paint] ?? 0xff2bd6, 1.6);
    // Make player invisible
    this.playerGroup.visible = false;
    // Tally bestChain
    if (this.chainCount > this.bestChain) this.bestChain = this.chainCount;
    this.endRun();
  }

  // -------- Visual damage --------
  private applyPlayerDamageVisual() {
    const ratio = clamp(this.health / this.maxHealth, 0, 1);
    if (this.playerParts.damageMaterial) {
      const mat = this.playerParts.damageMaterial;
      const orig = new THREE.Color(PAINT_COLORS[this.upgrades.paint] ?? 0xff2bd6);
      const dark = new THREE.Color(0x111111);
      mat.color.copy(orig).lerp(dark, 1 - ratio);
      mat.emissiveIntensity = 0.05 + (1 - ratio) * 0.4;
    }
    // Slight body sag / random rotation tweak as damage worsens
    this.playerParts.body.position.y = 0.85 + (1 - ratio) * 0.05 + Math.random() * 0.04 * (1 - ratio);
    // Spawn smoke if low health
    if (ratio < 0.4 && Math.random() < 0.6) {
      this.spawnParticleSmoke(this.playerGroup.position.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 1.4, -1.5)));
    }
  }

  // -------- FX spawning --------
  private spawnExplosion(pos: THREE.Vector3, power: number) {
    // Fireball flash
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.95,
    });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(2 * power, 10, 8), flashMat);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.particles.push({
      mesh: flash,
      velocity: new THREE.Vector3(0, 1, 0),
      life: 0.55,
      maxLife: 0.55,
      shrink: 1.5,
    });
    // Sparks
    for (let i = 0; i < 22 * power; i++) {
      const sparkColor = Math.random() < 0.5 ? 0xffd400 : 0xff7a00;
      const m = new THREE.MeshBasicMaterial({ color: sparkColor, transparent: true, opacity: 1 });
      const g = new THREE.SphereGeometry(0.18 + Math.random() * 0.18, 5, 4);
      const sp = new THREE.Mesh(g, m);
      sp.position.copy(pos);
      this.scene.add(sp);
      this.particles.push({
        mesh: sp,
        velocity: new THREE.Vector3(rand(-1, 1), rand(0.4, 1.6), rand(-1, 1)).multiplyScalar(rand(8, 18) * power),
        life: rand(0.5, 1.0),
        maxLife: 1,
        shrink: 1,
      });
    }
    // Smoke puffs
    for (let i = 0; i < 8 * power; i++) {
      this.spawnParticleSmoke(pos.clone().add(new THREE.Vector3(rand(-0.6, 0.6), rand(0.3, 1), rand(-0.6, 0.6))));
    }
  }

  private spawnParticleSmoke(pos: THREE.Vector3) {
    const m = new THREE.MeshBasicMaterial({ color: 0x222233, transparent: true, opacity: 0.9 });
    const g = new THREE.SphereGeometry(rand(0.4, 0.9), 6, 5);
    const sp = new THREE.Mesh(g, m);
    sp.position.copy(pos);
    this.scene.add(sp);
    this.particles.push({
      mesh: sp,
      velocity: new THREE.Vector3(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)).multiplyScalar(rand(0.6, 1.6)),
      life: rand(0.9, 1.6),
      maxLife: 1.5,
      shrink: 2,
    });
  }

  private spawnDebris(pos: THREE.Vector3, count: number, color: number, scale: number) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.4,
        emissive: color,
        emissiveIntensity: 0.18,
      });
      const dim = rand(0.18, 0.55) * scale;
      const geom = new THREE.BoxGeometry(dim, dim * rand(0.6, 1.4), dim * rand(0.6, 1.4));
      const m = new THREE.Mesh(geom, mat);
      m.position.copy(pos);
      m.position.y += rand(0.2, 1.5);
      this.scene.add(m);
      this.debris.push({
        mesh: m,
        velocity: new THREE.Vector3(rand(-1, 1), rand(0.6, 1.6), rand(-1, 1)).multiplyScalar(rand(6, 15) * scale),
        angularVelocity: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
        life: rand(1.2, 2.5),
        maxLife: 2.5,
      });
    }
  }

  private spawnScrap(pos: THREE.Vector3, value: number) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5eff7c,
      emissive: 0x5eff7c,
      emissiveIntensity: 1.2,
      metalness: 0.4,
      roughness: 0.3,
    });
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
    m.position.copy(pos);
    m.position.y += 0.6;
    this.scene.add(m);
    this.scraps.push({
      mesh: m,
      position: m.position,
      velocity: new THREE.Vector3(rand(-3, 3), rand(2, 5), rand(-1, 3)),
      alive: true,
      age: 0,
      value,
    });
  }

  private disposeCarParts(parts: CarParts) {
    parts.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      }
    });
  }
}
