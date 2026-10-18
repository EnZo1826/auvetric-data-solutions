import { cx } from "@/components/ui/primitives";

/**
 * Animated line illustrations for the four practices. Pure SVG + CSS; static under reduced motion.
 * Decorative: always aria-hidden — the adjacent text carries the meaning.
 */
export function PracticeArt({ slug, className }: { slug: string; className?: string }) {
  const common = cx("h-full w-full", className);
  switch (slug) {
    case "engineering-development":
      return <EngineeringArt className={common} />;
    case "data-business-intelligence":
      return <DataArt className={common} />;
    case "automation-intelligent-systems":
      return <AutomationArt className={common} />;
    default:
      return <ConsultancyArt className={common} />;
  }
}

/** Edge controller on a circuit board with signals travelling along traces. */
function EngineeringArt({ className }: { className: string }) {
  const traces = [
    "M20 40 H90 V80 H140",
    "M20 120 H70 V100 H140",
    "M20 160 H110 V130 H140",
    "M260 70 H300 V30 H380",
    "M260 110 H380",
    "M260 150 H320 V180 H380",
  ];
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden fill="none">
      <g stroke="#0069f5" strokeOpacity="0.28">
        {traces.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g stroke="#77b5ff" strokeWidth="1.6">
        {traces.map((d, i) => (
          <path key={i} d={d} strokeDasharray="10 200" className="trace-run" style={{ animationDuration: `${2 + i * 0.4}s`, animationDelay: `${i * 0.3}s` }} pathLength={210} />
        ))}
      </g>
      <rect x="140" y="40" width="120" height="120" rx="8" stroke="#f3f7ff" strokeOpacity="0.5" fill="#091326" />
      <rect x="160" y="60" width="80" height="80" rx="4" stroke="#0069f5" strokeOpacity="0.8" />
      {Array.from({ length: 6 }).map((_, i) => (
        <g key={i} stroke="#f3f7ff" strokeOpacity="0.35">
          <line x1={152 + i * 19} y1="40" x2={152 + i * 19} y2="32" />
          <line x1={152 + i * 19} y1="160" x2={152 + i * 19} y2="168" />
        </g>
      ))}
      <circle cx="200" cy="100" r="9" fill="#0069f5" />
      <circle cx="200" cy="100" r="9" stroke="#0069f5" className="pulse-ring" />
      <text x="200" y="128" textAnchor="middle" className="fill-mute font-mono" fontSize="8" letterSpacing="1">EDGE-01</text>
      {[40, 120, 160].map((y) => <circle key={y} cx="20" cy={y} r="3" fill="#0069f5" />)}
    </svg>
  );
}

/** Scattered records aligning into a validated column chart. */
function DataArt({ className }: { className: string }) {
  const bars = [62, 88, 54, 120, 96, 140, 110];
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden fill="none">
      <g stroke="#9dafc8" strokeOpacity="0.12">
        {[40, 80, 120, 160].map((y) => <line key={y} x1="150" x2="390" y1={y} y2={y} />)}
      </g>
      {/* raw records */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={i} x={14 + (i % 4) * 28 + (i % 3) * 3} y={22 + Math.floor(i / 4) * 40 + (i % 2) * 6} width="20" height="6" rx="2"
          fill={i === 3 || i === 9 ? "#F0B35A" : "#00d4ea"} fillOpacity={i === 3 || i === 9 ? 0.9 : 0.45} className="blink-soft" style={{ animationDelay: `${i * 0.17}s` }} />
      ))}
      <path d="M128 100 H150" stroke="#00d4ea" strokeOpacity="0.6" className="flow-dash" />
      {bars.map((h, i) => (
        <rect key={i} x={164 + i * 32} y={180 - h} width="18" height={h} rx="2" fill="#00d4ea" fillOpacity={0.25 + i * 0.08} className="bar-grow" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
      <path d="M173 120 L205 98 L237 128 L269 64 L301 82 L333 44 L365 66" stroke="#5ae7f2" strokeWidth="1.6" />
      <circle cx="333" cy="44" r="4" fill="#49D7B1" />
      <text x="390" y="196" textAnchor="end" className="fill-mute font-mono" fontSize="8" letterSpacing="1">VALIDATED</text>
    </svg>
  );
}

/** Event packet travelling through gates, pausing at a human approval node. */
function AutomationArt({ className }: { className: string }) {
  const path = "M20 100 H110 C130 100 130 50 150 50 H250 C270 50 270 100 290 100 H380";
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="autoGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#0069f5" />
          <stop offset="1" stopColor="#00d4ea" />
        </linearGradient>
      </defs>
      <path id="auto-p" d={path} stroke="url(#autoGrad)" strokeOpacity="0.55" />
      <path d="M110 100 C130 100 130 150 150 150 H250 C270 150 270 100 290 100" stroke="#9dafc8" strokeOpacity="0.25" strokeDasharray="3 5" />
      {[
        { x: 20, y: 100, c: "#0069f5", l: "EVENT" },
        { x: 110, y: 100, c: "#f3f7ff", l: "RULES" },
        { x: 200, y: 50, c: "#F0B35A", l: "APPROVE" },
        { x: 200, y: 150, c: "#9dafc8", l: "EXCEPTION" },
        { x: 380, y: 100, c: "#00d4ea", l: "NOTIFY" },
      ].map((n) => (
        <g key={n.l}>
          <rect x={n.x - 9} y={n.y - 9} width="18" height="18" rx="4" fill="#091326" stroke={n.c} />
          <text x={n.x} y={n.y + 24} textAnchor="middle" className="fill-mute font-mono" fontSize="7.5" letterSpacing="1">{n.l}</text>
        </g>
      ))}
      <circle r="4.5" fill="#f3f7ff">
        <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;0.42;0.5;0.5;1" keyTimes="0;0.3;0.42;0.62;1" calcMode="linear">
          <mpath href="#auto-p" />
        </animateMotion>
      </circle>
    </svg>
  );
}

/** Blueprint layers: current state → target architecture, with a rotating schematic. */
function ConsultancyArt({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden fill="none">
      <g stroke="#9dafc8" strokeOpacity="0.1">
        {Array.from({ length: 21 }).map((_, i) => <line key={`v${i}`} x1={i * 20} x2={i * 20} y1="0" y2="200" />)}
        {Array.from({ length: 11 }).map((_, i) => <line key={`h${i}`} y1={i * 20} y2={i * 20} x1="0" x2="400" />)}
      </g>
      {/* current state — tangled */}
      <g stroke="#0069f5" strokeOpacity="0.55">
        <path d="M30 60 C80 20 60 160 120 120 S 90 40 150 80" />
        <path d="M30 140 C90 180 70 60 130 60" />
      </g>
      {[[30, 60], [30, 140], [120, 120], [150, 80], [130, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#091326" stroke="#0069f5" />)}
      <path d="M175 100 H225" stroke="#f3f7ff" strokeOpacity="0.6" className="flow-dash" />
      <path d="M219 94 L227 100 L219 106" stroke="#f3f7ff" strokeOpacity="0.6" />
      {/* target — ordered */}
      <g stroke="#00d4ea" strokeOpacity="0.7">
        <path d="M260 50 H360 M260 100 H360 M260 150 H360 M310 50 V150" />
      </g>
      {[[260, 50], [360, 50], [260, 100], [360, 100], [260, 150], [360, 150], [310, 100]].map(([x, y], i) => <rect key={i} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill="#091326" stroke="#00d4ea" />)}
      <g className="spin-slow" style={{ transformOrigin: "310px 100px" }}>
        <circle cx="310" cy="100" r="26" stroke="#f3f7ff" strokeOpacity="0.25" strokeDasharray="2 6" />
      </g>
    </svg>
  );
}
