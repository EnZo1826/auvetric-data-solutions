export interface Industry {
  slug: string;
  name: string;
  experience: "direct" | "applicable";
  focus: string[];
  challenge: string;
  approach: string;
  practices: string[];
  projects: string[];
  motif: "retail" | "industrial" | "fleet" | "security" | "sme" | "agri";
}

export const industries: Industry[] = [
  {
    slug: "retail-fmcg",
    name: "Retail & FMCG",
    experience: "direct",
    focus: ["Master-data integrity", "Pricing & margin analytics", "Supplier reconciliation", "Inventory reporting", "Multi-store processes", "Business intelligence"],
    challenge: "Product, cost and price data flows from suppliers through distribution centres to stores, and small inconsistencies at each step quietly erode margin.",
    approach: "Profile and reconcile master data across sources, codify the business rules, route exceptions to owners and report margin on validated data.",
    practices: ["data-business-intelligence", "automation-intelligent-systems"],
    projects: ["multi-store-data-centralisation", "master-data-reconciliation", "promotional-pricing-invoice-analysis", "concept-connected-retail"],
    motif: "retail",
  },
  {
    slug: "manufacturing-industrial",
    name: "Manufacturing & Industrial Operations",
    experience: "direct",
    focus: ["Equipment telemetry", "IoT integrations", "Process dashboards", "Alarm & event monitoring", "Industrial automation"],
    challenge: "Process conditions and consumables are measured on site but rarely reach the people and systems that need them, in time and in a trustworthy form.",
    approach: "Acquire signals at the edge, buffer through outages, transport over MQTT, and present live and historical views with alarms that reflect data age.",
    practices: ["engineering-development", "automation-intelligent-systems"],
    projects: ["industrial-monitoring-telemetry", "industrial-fuel-management", "mqtt-led-displays", "concept-industrial-operations"],
    motif: "industrial",
  },
  {
    slug: "logistics-fleet",
    name: "Logistics & Fleet",
    experience: "direct",
    focus: ["GPS telemetry", "Fleet dashboards", "Driver events", "Dispatch workflows", "Asset visibility", "Operational reporting"],
    challenge: "Telematics produces large volumes of positions and events, but managers need exceptions, cost drivers and service performance.",
    approach: "Integrate with existing telematics devices and platforms, normalise events, apply business rules and report against operational KPIs.",
    practices: ["engineering-development", "data-business-intelligence"],
    projects: ["gps-fleet-integrations", "concept-fleet-operations"],
    motif: "fleet",
  },
  {
    slug: "security-facilities",
    name: "Security & Facilities",
    experience: "direct",
    focus: ["Visitor management", "Security operations software", "Event monitoring", "Vehicle access workflows", "Camera integrations", "Remote operations"],
    challenge: "Gate and site records are captured under time pressure, often offline, and must still produce an accurate, auditable central record.",
    approach: "Offline-first capture applications with reliable synchronisation into central systems, plus integrations with cameras and access hardware via their APIs.",
    practices: ["engineering-development"],
    projects: ["security-checkpoint"],
    motif: "security",
  },
  {
    slug: "sme-professional",
    name: "SMEs & Professional Services",
    experience: "applicable",
    focus: ["Custom software", "Process digitisation", "Reporting", "ERP integrations", "Document workflows", "Operational automation"],
    challenge: "Growing organisations outgrow spreadsheets and email approvals before they can justify enterprise platforms.",
    approach: "Right-sized applications, ERPNext where it fits, and automation of the repetitive steps — with reporting built in from the start.",
    practices: ["engineering-development", "automation-intelligent-systems", "technology-consultancy"],
    projects: ["erpnext-frappe-applications"],
    motif: "sme",
  },
  {
    slug: "agriculture-remote",
    name: "Agriculture & Remote Operations",
    experience: "applicable",
    focus: ["Field telemetry", "Remote monitoring architectures", "Equipment connectivity", "Offline-first workflows", "Asset monitoring concepts"],
    challenge: "Remote sites have long distances, limited power and patchy cellular coverage — conditions most software ignores.",
    approach: "Low-power edge devices, store-and-forward telemetry and offline-first field applications designed around real connectivity.",
    practices: ["engineering-development", "technology-consultancy"],
    projects: ["industrial-monitoring-telemetry"],
    motif: "agri",
  },
];
