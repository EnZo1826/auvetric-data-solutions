import type { FounderId } from "./founders";

export type TechLevel = "practical" | "working" | "exploring" | "site";

export const techLevelLabel: Record<TechLevel, string> = {
  practical: "Practical experience",
  working: "Working knowledge",
  exploring: "Exploring / developing",
  site: "Used to build this website",
};

export interface Tech {
  name: string;
  level: TechLevel;
  who: FounderId[];
  role: string;
  evidence?: string; // case-study slug
}

export interface TechGroup {
  id: string;
  name: string;
  accent: "eng" | "data" | "converge";
  techs: Tech[];
}

export const techGroups: TechGroup[] = [
  {
    id: "app",
    name: "Application Engineering",
    accent: "eng",
    techs: [
      { name: "JavaScript / Node.js", level: "practical", who: ["jakes"], role: "Backend services, integration workers, tooling", evidence: "realtime-operational-dashboards" },
      { name: "Python", level: "practical", who: ["jakes"], role: "Frappe apps, edge scripts, data handling", evidence: "erpnext-frappe-applications" },
      { name: "HTML / CSS", level: "practical", who: ["jakes"], role: "Responsive operational interfaces" },
      { name: "REST APIs", level: "practical", who: ["jakes"], role: "System-to-system integration", evidence: "security-checkpoint" },
      { name: "WebSockets / SSE", level: "practical", who: ["jakes"], role: "Live dashboards and device streams", evidence: "realtime-operational-dashboards" },
      { name: "PWAs (offline-first)", level: "practical", who: ["jakes"], role: "Field apps that survive connectivity loss", evidence: "security-checkpoint" },
      { name: "Frappe / ERPNext", level: "practical", who: ["jakes"], role: "ERP customisation and integration", evidence: "erpnext-frappe-applications" },
      { name: "Next.js / React / TypeScript", level: "site", who: ["jakes"], role: "This website and interactive demos" },
    ],
  },
  {
    id: "data",
    name: "Data & Analytics",
    accent: "data",
    techs: [
      { name: "Excel (advanced)", level: "practical", who: ["alex"], role: "Reconciliation, modelling, variance analysis", evidence: "master-data-reconciliation" },
      { name: "Power BI", level: "practical", who: ["alex"], role: "KPI models and management reporting", evidence: "promotional-pricing-invoice-analysis" },
      { name: "Power Query", level: "practical", who: ["alex"], role: "Repeatable data shaping", evidence: "master-data-reconciliation" },
      { name: "SharePoint", level: "working", who: ["alex"], role: "Document and list-based workflows" },
      { name: "Data reconciliation", level: "practical", who: ["alex"], role: "Cross-source matching and exception reporting", evidence: "fmcg-data-cleansing-framework" },
      { name: "Data governance", level: "practical", who: ["alex"], role: "Quality dimensions, lineage, ownership", evidence: "multi-store-data-centralisation" },
      { name: "SQL", level: "exploring", who: ["alex"], role: "Development area" },
      { name: "Python / Pandas", level: "exploring", who: ["alex"], role: "Development area" },
      { name: "Advanced DAX", level: "exploring", who: ["alex"], role: "Development area" },
    ],
  },
  {
    id: "industrial",
    name: "Industrial & Embedded",
    accent: "eng",
    techs: [
      { name: "Raspberry Pi / CM", level: "practical", who: ["jakes"], role: "Edge gateways and controllers", evidence: "industrial-monitoring-telemetry" },
      { name: "Industrial Shields PLCs", level: "practical", who: ["jakes"], role: "Industrial I/O and pulse acquisition", evidence: "industrial-fuel-management" },
      { name: "RP2040 / Pico W", level: "practical", who: ["jakes"], role: "Embedded controllers" },
      { name: "ESP32-S3", level: "practical", who: ["jakes"], role: "Connected sensors and displays", evidence: "mqtt-led-displays" },
      { name: "MicroPython", level: "practical", who: ["jakes"], role: "Embedded firmware" },
      { name: "Modbus", level: "practical", who: ["jakes"], role: "Industrial device communication", evidence: "industrial-monitoring-telemetry" },
      { name: "MQTT", level: "practical", who: ["jakes"], role: "Device and event messaging", evidence: "mqtt-led-displays" },
      { name: "GPIO / digital & analog I/O", level: "practical", who: ["jakes"], role: "Signal acquisition", evidence: "industrial-fuel-management" },
    ],
  },
  {
    id: "cloud",
    name: "Cloud & Infrastructure",
    accent: "eng",
    techs: [
      { name: "AWS (EC2, Route 53)", level: "practical", who: ["jakes"], role: "Application hosting and DNS" },
      { name: "Ubuntu Linux", level: "practical", who: ["jakes"], role: "Servers and edge devices" },
      { name: "Docker / Compose", level: "practical", who: ["jakes"], role: "Service packaging and deployment", evidence: "gps-fleet-integrations" },
      { name: "nginx", level: "practical", who: ["jakes"], role: "Reverse proxy, TLS, streaming", evidence: "realtime-operational-dashboards" },
      { name: "Git / GitHub", level: "practical", who: ["jakes"], role: "Source control and delivery" },
      { name: "systemd", level: "practical", who: ["jakes"], role: "Service supervision" },
      { name: "VPN & remote connectivity", level: "practical", who: ["jakes"], role: "Secure access to remote sites" },
    ],
  },
  {
    id: "automation",
    name: "Automation & AI",
    accent: "converge",
    techs: [
      { name: "Node-RED", level: "practical", who: ["jakes"], role: "Device and integration flows", evidence: "industrial-monitoring-telemetry" },
      { name: "Power Automate", level: "practical", who: ["alex"], role: "Microsoft 365 workflow automation" },
      { name: "n8n", level: "working", who: ["jakes"], role: "Integration workflows" },
      { name: "Claude Code", level: "practical", who: ["jakes"], role: "AI-assisted development", evidence: "ai-agent-automation-experiments" },
      { name: "OpenAI / Codex", level: "working", who: ["jakes"], role: "AI-assisted development", evidence: "ai-agent-automation-experiments" },
      { name: "Ollama / local LLMs", level: "exploring", who: ["jakes"], role: "Private, local inference experiments", evidence: "ai-agent-automation-experiments" },
      { name: "Hermes Agent", level: "working", who: ["jakes"], role: "Agent orchestration experiments", evidence: "ai-agent-automation-experiments" },
      { name: "Paperclip", level: "working", who: ["jakes"], role: "Multi-agent coordination experiments", evidence: "ai-agent-automation-experiments" },
      { name: "Power Apps / AI Builder / Copilot Studio", level: "exploring", who: ["alex"], role: "Development area" },
    ],
  },
  {
    id: "databases",
    name: "Databases & Telemetry",
    accent: "converge",
    techs: [
      { name: "MariaDB", level: "practical", who: ["jakes"], role: "Frappe / ERPNext data layer", evidence: "erpnext-frappe-applications" },
      { name: "PostgreSQL-family systems", level: "working", who: ["jakes"], role: "Spatial and relational data", evidence: "gps-fleet-integrations" },
      { name: "InfluxDB / time-series", level: "working", who: ["jakes"], role: "Telemetry history" },
      { name: "Supabase", level: "working", who: ["jakes"], role: "Hosted Postgres for PWAs" },
      { name: "PocketBase", level: "working", who: ["jakes"], role: "Lightweight application backends" },
      { name: "IndexedDB (Dexie)", level: "practical", who: ["jakes"], role: "Offline-first local storage", evidence: "security-checkpoint" },
    ],
  },
];
