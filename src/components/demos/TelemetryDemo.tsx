"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { ALARM_DELAY, LIMIT, WINDOW, initialState, setScenario, statusOf, step, type Point, type Scenario, type SimState } from "@/lib/telemetry";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cx, SyntheticTag } from "@/components/ui/primitives";

type Action = { type: "tick" } | { type: "scenario"; s: Scenario } | { type: "reset" };
function reducer(state: SimState, a: Action): SimState {
  if (a.type === "tick") return step(state);
  if (a.type === "scenario") return setScenario(state, a.s);
  return initialState();
}

const SCENARIOS: { id: Scenario; label: string; hint: string }[] = [
  { id: "normal", label: "Normal operation", hint: "Pressure around 6.2 bar; values flow end-to-end in about a second." },
  { id: "threshold", label: "Threshold exceeded", hint: `Pressure ramps past ${LIMIT} bar. The edge raises an alarm only after ${ALARM_DELAY} consecutive samples, avoiding nuisance alarms.` },
  { id: "sensor", label: "Sensor disconnect", hint: "The loop current drops below 3.8 mA. Values become quality=bad and are not plotted as real readings." },
  { id: "link", label: "Connectivity interruption", hint: "The uplink drops. The edge keeps sampling and buffers locally; the dashboard shows the data is going stale." },
  { id: "reconnect", label: "Reconnect & sync", hint: "The uplink returns. Buffered samples are back-filled in order, so history has no gaps." },
];

const STATUS_TONE: Record<string, string> = {
  ok: "text-ok border-ok/40", normal: "text-ok border-ok/40", syncing: "text-data-ink border-data/40", waiting: "text-warn border-warn/40",
  down: "text-eng-ink border-eng/50", fault: "text-eng-ink border-eng/50", alarm: "text-eng-ink border-eng/50", unknown: "text-warn border-warn/40",
};

export function TelemetryDemo() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || !inView) return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 600);
    return () => window.clearInterval(id);
  }, [paused, inView]);

  const st = statusOf(state);
  const last = state.server[state.server.length - 1];
  const scen = SCENARIOS.find((s) => s.id === state.scenario)!;

  return (
    <div ref={ref} className="overflow-hidden rounded-3xl border border-line bg-base">
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Scenarios">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={state.scenario === s.id}
              onClick={() => dispatch({ type: "scenario", s: s.id })}
              disabled={(s.id === "reconnect" && state.link) || (s.id === "link" && !state.link)}
              className={cx(
                "min-h-11 rounded-xl border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                state.scenario === s.id ? "border-eng/60 bg-eng/10 text-ink" : "border-line text-mute hover:text-ink",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPaused((p) => !p)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs text-ink hover:border-mute" aria-pressed={paused}>
            {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />} {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={() => { dispatch({ type: "reset" }); setPaused(false); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-xs text-ink hover:border-mute">
            <RotateCcw className="size-4" aria-hidden /> Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <p key={scen.id} className="rise-in max-w-[80ch] text-sm text-mute" aria-live="polite"><span className="text-ink">{scen.label}. </span>{scen.hint}</p>
        <SyntheticTag>Simulated plant · no hardware connected</SyntheticTag>
      </div>

      <div className="grid gap-px bg-line pt-4 lg:grid-cols-12">
        {/* Schematic */}
        <div className="bg-base p-4 sm:p-6 lg:col-span-5">
          <Schematic state={state} animate={!reduced && !paused} />
          <ul className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {([
              ["Sensor PT-101", st.sensor],
              ["Edge gateway", st.edge],
              ["MQTT uplink", st.mqtt],
              ["Backend", st.backend],
              ["Process", st.process],
              ["Edge buffer", state.buffer.length ? `${state.buffer.length} queued` : "empty"],
            ] as const).map(([label, val]) => (
              <li key={label} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2">
                <span className="text-dim">{label}</span>
                <span className={cx("rounded-full border px-2 py-0.5 font-mono text-[0.62rem] uppercase", STATUS_TONE[val] ?? (val === "empty" ? "text-dim border-line" : "text-data-ink border-data/40"))}>{val}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Operator dashboard */}
        <div className="bg-base p-4 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Operator view · Pump P-1 discharge pressure</p>
              <p className="mt-1 font-display text-5xl tracking-[-0.03em] tabular">
                <span className={cx(st.stale ? "text-dim" : st.process === "alarm" ? "text-eng-ink" : last?.v == null ? "text-warn" : "text-ink")}>
                  {last?.v == null ? "— —" : last.v.toFixed(2)}
                </span>
                <span className="ml-2 text-lg text-dim">bar</span>
              </p>
            </div>
            <div className="text-right">
              <p className={cx("font-mono text-xs", st.stale ? "text-warn" : "text-ok")}>{st.stale ? `STALE · last data ${st.dataAge}s ago` : "LIVE · data age < 1 s"}</p>
              <p className="mt-1 font-mono text-[0.65rem] text-dim">limit {LIMIT} bar · alarm delay {ALARM_DELAY}s · sim time {state.t}s</p>
            </div>
          </div>
          <Chart state={state} />
          <div className="mt-2 flex flex-wrap gap-4 text-[0.68rem] text-dim">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-data" /> Received live</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-ok" /> Back-filled from edge buffer</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-mute" /> Edge-side samples</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-eng" /> Alarm limit</span>
          </div>

          <div className="mt-5">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Event log</p>
            <ol className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2 font-mono text-[0.72rem]" aria-live="polite" aria-relevant="additions">
              {state.events.slice(0, 12).map((e, i) => (
                <li key={`${e.t}-${i}-${e.msg}`} className="grid grid-cols-[3.2rem_4.4rem_1fr] gap-2">
                  <span className="text-dim tabular">t+{e.t}s</span>
                  <span className={cx(e.level === "alarm" ? "text-eng-ink" : e.level === "warn" ? "text-warn" : "text-data-ink")}>{e.source}</span>
                  <span className="text-mute">{e.msg}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Schematic({ state, animate }: { state: SimState; animate: boolean }) {
  const st = statusOf(state);
  const v = state.edge[state.edge.length - 1]?.v;
  const needle = v == null ? -120 : -120 + (Math.min(v, 11) / 11) * 240;
  const bufPct = Math.min(1, state.buffer.length / 40);
  const nodes = [
    { x: 40, label: "SENSOR", sub: "PT-101", c: st.sensor === "ok" ? "#DA3633" : "#F0B35A" },
    { x: 130, label: "EDGE", sub: "EDGE-01", c: "#DA3633" },
    { x: 220, label: "MQTT", sub: "broker", c: state.link ? "#F3F6FA" : "#F2716D" },
    { x: 310, label: "API", sub: "ingest", c: "#00C8D7" },
    { x: 400, label: "DASH", sub: "operator", c: "#00C8D7" },
  ];
  return (
    <svg viewBox="0 0 440 210" className="w-full" role="img" aria-label={`Telemetry path: sensor ${st.sensor}, uplink ${st.mqtt}, ${state.buffer.length} samples buffered at the edge.`}>
      {/* gauge */}
      <g transform="translate(40 58)">
        <circle r="34" fill="#0D1117" stroke="#2f3b4b" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = ((-120 + i * (240 / 11)) * Math.PI) / 180;
          const hot = i >= 9;
          return <line key={i} x1={Math.sin(a) * 27} y1={-Math.cos(a) * 27} x2={Math.sin(a) * 32} y2={-Math.cos(a) * 32} stroke={hot ? "#DA3633" : "#99A8BA"} strokeOpacity={hot ? 0.9 : 0.4} />;
        })}
        <line x1="0" y1="0" x2="0" y2="-25" stroke={v == null ? "#F0B35A" : "#F3F6FA"} strokeWidth="2" strokeLinecap="round" transform={`rotate(${needle})`} style={{ transition: "transform .5s cubic-bezier(.16,1,.3,1)" }} />
        <circle r="3" fill="#F3F6FA" />
      </g>
      {/* links */}
      {nodes.slice(0, -1).map((n, i) => {
        const x1 = n.x + 16, x2 = nodes[i + 1].x - 16, y = 150;
        const broken = i === 1 && !state.link;
        const idle = !state.link && i >= 1;
        return (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={broken ? "#DA3633" : "#2f3b4b"} strokeDasharray={broken ? "3 4" : undefined} />
            {!idle && animate && !(i === 0 && !state.sensorOk) && (
              <circle r="2.6" fill={i < 2 ? "#F2716D" : "#3FDBE6"}>
                <animate attributeName="cx" from={x1} to={x2} dur="0.9s" repeatCount="indefinite" begin={`${i * 0.15}s`} />
                <animate attributeName="cy" from={y} to={y} dur="0.9s" repeatCount="indefinite" />
              </circle>
            )}
            {broken && <g transform={`translate(${(x1 + x2) / 2} ${y})`} stroke="#F2716D" strokeWidth="2"><line x1="-5" y1="-5" x2="5" y2="5" /><line x1="5" y1="-5" x2="-5" y2="5" /></g>}
          </g>
        );
      })}
      {nodes.map((n) => (
        <g key={n.label}>
          <rect x={n.x - 16} y={134} width="32" height="32" rx="6" fill="#0D1117" stroke={n.c} />
          <text x={n.x} y={182} textAnchor="middle" fontSize="9" letterSpacing="1" className="fill-mute font-mono">{n.label}</text>
          <text x={n.x} y={194} textAnchor="middle" fontSize="8" className="fill-dim font-mono">{n.sub}</text>
        </g>
      ))}
      <line x1="40" y1="92" x2="40" y2="134" stroke="#2f3b4b" />
      {/* edge buffer */}
      <g transform="translate(118 40)">
        <text x="12" y="-6" textAnchor="middle" fontSize="8" className="fill-dim font-mono">BUFFER</text>
        <rect x="0" y="0" width="24" height="80" rx="3" fill="#0D1117" stroke="#2f3b4b" />
        <rect x="2" y={2 + 76 * (1 - bufPct)} width="20" height={76 * bufPct} rx="2" fill={state.link ? "#49D7B1" : "#F0B35A"} style={{ transition: "all .4s" }} />
        <text x="12" y="94" textAnchor="middle" fontSize="9" className="fill-mute font-mono">{state.buffer.length}</text>
      </g>
      <line x1="130" y1="134" x2="130" y2="126" stroke="#2f3b4b" />
      {/* alarm beacon */}
      <g transform="translate(400 70)">
        <circle r="14" fill={st.process === "alarm" ? "#DA3633" : "#0D1117"} stroke={st.process === "alarm" ? "#DA3633" : "#2f3b4b"} />
        {st.process === "alarm" && animate && <circle r="14" fill="none" stroke="#DA3633" className="pulse-ring" />}
        <text y="30" textAnchor="middle" fontSize="8" className="fill-dim font-mono">ALARM</text>
      </g>
      <line x1="400" y1="104" x2="400" y2="134" stroke="#2f3b4b" />
    </svg>
  );
}

function Chart({ state }: { state: SimState }) {
  const W = 640, H = 200, P = { l: 34, r: 8, t: 10, b: 20 };
  const minT = state.t - WINDOW + 1;
  const X = (t: number) => P.l + ((t - minT) / (WINDOW - 1)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - v / 11) * (H - P.t - P.b);

  const segments = (pts: Point[], pred: (p: Point) => boolean) => {
    const out: string[] = [];
    let cur: string[] = [];
    let prevT = -Infinity;
    for (const p of pts) {
      if (p.v == null || !pred(p) || p.t !== prevT + 1) { if (cur.length > 1) out.push(cur.join(" ")); cur = []; }
      if (p.v != null && pred(p)) cur.push(`${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`);
      prevT = p.t;
    }
    if (cur.length > 1) out.push(cur.join(" "));
    return out;
  };

  const edgeLines = segments(state.edge, () => true);
  const liveLines = segments(state.server, (p) => !p.backfilled);
  const backfillLines = segments(state.server, (p) => !!p.backfilled);
  const badPts = state.edge.filter((p) => p.q === "bad");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={`Pressure history, last ${WINDOW} seconds. ${badPts.length} bad-quality samples, ${state.buffer.length} samples waiting in the edge buffer.`}>
      {[0, 2, 4, 6, 8, 10].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="#222c39" />
          <text x={P.l - 6} y={Y(v) + 3} textAnchor="end" fontSize="9" className="fill-dim font-mono">{v}</text>
        </g>
      ))}
      <line x1={P.l} x2={W - P.r} y1={Y(LIMIT)} y2={Y(LIMIT)} stroke="#DA3633" strokeDasharray="4 3" />
      {badPts.map((p) => <rect key={p.t} x={X(p.t) - 2} y={P.t} width="4" height={H - P.t - P.b} fill="#F0B35A" fillOpacity="0.12" />)}
      {state.buffer.length > 0 && (
        <rect x={X(state.buffer[0].t)} y={P.t} width={Math.max(0, X(state.t) - X(state.buffer[0].t))} height={H - P.t - P.b} fill="#F0B35A" fillOpacity="0.06" stroke="#F0B35A" strokeOpacity="0.3" strokeDasharray="2 3" />
      )}
      {edgeLines.map((d, i) => <polyline key={`e${i}`} points={d} fill="none" stroke="#99A8BA" strokeOpacity="0.45" strokeDasharray="2 3" />)}
      {liveLines.map((d, i) => <polyline key={`l${i}`} points={d} fill="none" stroke="#00C8D7" strokeWidth="1.8" />)}
      {backfillLines.map((d, i) => <polyline key={`b${i}`} points={d} fill="none" stroke="#49D7B1" strokeWidth="1.8" />)}
      <text x={W - P.r} y={H - 4} textAnchor="end" fontSize="9" className="fill-dim font-mono">now</text>
      <text x={P.l} y={H - 4} fontSize="9" className="fill-dim font-mono">−{WINDOW}s</text>
    </svg>
  );
}
