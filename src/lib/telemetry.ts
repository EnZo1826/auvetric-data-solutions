/**
 * Deterministic industrial telemetry simulation for the public IoT demonstration.
 * Not connected to any hardware. Same scenario sequence → same output, every time.
 */
export type Scenario = "normal" | "threshold" | "sensor" | "link" | "reconnect";
export type Quality = "good" | "bad";

export interface Point { t: number; v: number | null; q: Quality; seq: number; backfilled?: boolean }
export interface AlarmEvent { t: number; level: "info" | "warn" | "alarm"; source: string; msg: string }

export interface SimState {
  t: number;
  seq: number;
  scenario: Scenario;
  link: boolean;
  sensorOk: boolean;
  edge: Point[]; // what the edge gateway sampled
  server: Point[]; // what the backend has stored
  buffer: Point[]; // store-and-forward queue on the edge
  lastServerT: number;
  aboveCount: number;
  highActive: boolean;
  events: AlarmEvent[];
  rampFrom: number | null;
}

export const LIMIT = 8.5; // bar
export const ALARM_DELAY = 3; // consecutive samples above limit
export const WINDOW = 72; // samples shown
export const FLUSH_RATE = 6; // buffered samples synced per tick after reconnect

// Deterministic pseudo-noise from tick index (mulberry32)
function noise(t: number) {
  let a = (t * 2654435761) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let r = Math.imul(a ^ (a >>> 15), 1 | a);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return (((r ^ (r >>> 14)) >>> 0) / 4294967296 - 0.5) * 2;
}

const base = (t: number) => 6.2 + 0.28 * Math.sin(t / 7) + 0.07 * noise(t);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function initialState(): SimState {
  let s: SimState = {
    t: 0, seq: 0, scenario: "normal", link: true, sensorOk: true,
    edge: [], server: [], buffer: [], lastServerT: 0, aboveCount: 0, highActive: false,
    events: [{ t: 0, level: "info", source: "SYSTEM", msg: "Simulation started — synthetic data, no hardware connected" }],
    rampFrom: null,
  };
  for (let i = 0; i < 40; i++) s = step(s);
  return s;
}

export function setScenario(s: SimState, scenario: Scenario): SimState {
  const ev: AlarmEvent[] = [];
  let { link, sensorOk } = s;
  if (scenario === "normal") { sensorOk = true; ev.push({ t: s.t, level: "info", source: "OPERATOR", msg: "Process returned to normal setpoint" }); }
  if (scenario === "threshold") { sensorOk = true; ev.push({ t: s.t, level: "info", source: "PROCESS", msg: "Downstream valve throttled — pressure rising" }); }
  if (scenario === "sensor") { sensorOk = false; ev.push({ t: s.t, level: "alarm", source: "PT-101", msg: "Loop current 2.1 mA — sensor fault (open circuit)" }); }
  if (scenario === "link") { link = false; ev.push({ t: s.t, level: "warn", source: "EDGE-01", msg: "Uplink lost — buffering locally" }); }
  if (scenario === "reconnect") { link = true; sensorOk = true; ev.push({ t: s.t, level: "info", source: "EDGE-01", msg: `Uplink restored — syncing ${s.buffer.length} buffered samples` }); }
  return { ...s, scenario, link, sensorOk, rampFrom: scenario === "threshold" ? s.t : null, events: [...ev, ...s.events].slice(0, 40) };
}

export function step(prev: SimState): SimState {
  const t = prev.t + 1;
  const seq = prev.seq + 1;
  const events: AlarmEvent[] = [];

  // 1. Acquire
  let v: number | null;
  if (!prev.sensorOk) v = null;
  else if (prev.scenario === "threshold" && prev.rampFrom !== null) {
    const k = Math.min(1, (t - prev.rampFrom) / 14);
    v = base(t) + k * 3.0 + 0.05 * noise(t * 3);
  } else v = base(t);
  const point: Point = { t, v: v === null ? null : r2(v), q: v === null ? "bad" : "good", seq };

  // 2. Edge logic — threshold alarm with delay
  let { aboveCount, highActive } = prev;
  if (point.v !== null && point.v > LIMIT) aboveCount += 1; else aboveCount = 0;
  if (!highActive && aboveCount >= ALARM_DELAY) { highActive = true; events.push({ t, level: "alarm", source: "PT-101", msg: `High pressure ${point.v?.toFixed(2)} bar > ${LIMIT} bar for ${ALARM_DELAY}s` }); }
  if (highActive && point.v !== null && point.v < LIMIT - 0.3) { highActive = false; events.push({ t, level: "info", source: "PT-101", msg: "High pressure cleared (hysteresis 0.3 bar)" }); }

  // 3. Transport — live publish or store-and-forward
  let buffer = prev.buffer;
  let server = prev.server;
  let lastServerT = prev.lastServerT;
  if (prev.link) {
    const flush = buffer.slice(0, FLUSH_RATE).map((p) => ({ ...p, backfilled: true }));
    buffer = buffer.slice(FLUSH_RATE);
    server = [...server, ...flush, point].sort((a, b) => a.t - b.t);
    lastServerT = t;
    if (flush.length && buffer.length === 0) events.push({ t, level: "info", source: "INGEST", msg: "Backfill complete — history has no gaps" });
  } else {
    buffer = [...buffer, point];
  }

  const minT = t - WINDOW + 1;
  return {
    ...prev, t, seq, aboveCount, highActive, buffer, lastServerT,
    edge: [...prev.edge, point].filter((p) => p.t >= minT),
    server: server.filter((p) => p.t >= minT),
    events: [...events, ...prev.events].slice(0, 40),
  };
}

export function statusOf(s: SimState) {
  const age = s.t - s.lastServerT;
  return {
    sensor: s.sensorOk ? "ok" : "fault",
    edge: "ok",
    mqtt: s.link ? (s.buffer.length ? "syncing" : "ok") : "down",
    backend: s.link ? "ok" : "waiting",
    dataAge: age,
    stale: age > 2,
    process: s.highActive ? "alarm" : s.sensorOk ? "normal" : "unknown",
  } as const;
}
