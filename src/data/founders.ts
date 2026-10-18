export type FounderId = "jakes" | "alex";

export interface Founder {
  id: FounderId;
  displayName: string;
  publicIdentity: string;
  discipline: "engineering" | "data";
  title: string;
  location: string;
  /** Verified, user-supplied biography. Keep factual; no invented credentials. */
  bio: string[];
  philosophy: string;
  competencies: { group: string; items: string[] }[];
  developing?: string[];
  responsibilities: string[];
  links: { label: string; href: string }[];
  headshot: string | null; // path under /public once supplied
  needsConfirmation: string[]; // shown only in this config, not on the site
}

export const founders: Founder[] = [
  {
    id: "jakes",
    displayName: "Jakes9NA",
    publicIdentity: "Jakes9NA",
    discipline: "engineering",
    title: "Systems Engineering & Software Development",
    location: "Windhoek, Namibia",
    bio: [
      "Jakes9NA is a cross-disciplinary engineer who works from the field device to the dashboard: industrial controllers and sensors, edge gateways, message brokers, backend services, ERP integrations and the operational applications people use every day.",
      "His work centres on systems that have to keep running in real conditions — intermittent connectivity, remote sites, shift work and equipment that cannot wait for a perfect network. Offline-first applications, resilient synchronisation and practical monitoring are recurring themes.",
    ],
    philosophy:
      "Working systems beat elegant diagrams. Design for the conditions the system will actually face, make failure visible, and keep the operator in control.",
    competencies: [
      { group: "Application engineering", items: ["JavaScript & Node.js", "Python", "REST APIs & WebSockets", "Offline-first PWAs", "Operational dashboards"] },
      { group: "Enterprise integration", items: ["Frappe Framework", "ERPNext v15 / v16", "Node-RED", "MQTT", "Data synchronisation"] },
      { group: "Industrial & embedded", items: ["Industrial Shields Raspberry Pi PLCs", "Modbus", "Digital / analog I/O & pulse acquisition", "RP2040 / Pico W", "ESP32-S3 & MicroPython"] },
      { group: "Infrastructure", items: ["AWS EC2 & Route 53", "Ubuntu Linux", "Docker & Compose", "nginx, TLS, reverse proxy", "VPN & remote connectivity"] },
      { group: "Operational technology", items: ["GPS & telematics integrations", "Security checkpoint applications", "IP camera & access-control integrations", "LED matrix controllers"] },
      { group: "AI engineering (applied & exploratory)", items: ["Claude Code", "OpenAI / Codex", "Ollama & local LLMs", "Hermes Agent", "Paperclip", "n8n"] },
    ],
    responsibilities: [
      "Technical architecture",
      "Application development",
      "Hardware and device integration",
      "APIs, databases and services",
      "Automation services",
      "Infrastructure and deployment",
      "Monitoring and synchronisation",
    ],
    links: [{ label: "GitHub — EnZo1826", href: "https://github.com/EnZo1826" }],
    headshot: null,
    needsConfirmation: ["Public real name (optional)", "Headshot", "LinkedIn URL"],
  },
  {
    id: "alex",
    displayName: "Alex",
    publicIdentity: "Alex",
    discipline: "data",
    title: "Enterprise Data, BI & Business Process Optimisation",
    location: "Windhoek, Namibia",
    bio: [
      "Alex brings approximately four years of business operations and retail experience, including enterprise data administration, operational reporting, commercial analytics, data integrity and multi-location business-system coordination.",
      "That experience includes participating in enterprise retail system conversion and data-centralisation initiatives within a major Namibian FMCG retail environment — work that sits exactly where product master data, supplier information, pricing and store operations meet.",
    ],
    philosophy:
      "A dashboard is only as trustworthy as the data underneath it. Start with where the information comes from, who owns it and how it can go wrong — then report on it.",
    competencies: [
      { group: "Advanced data processing", items: ["Complex Excel modelling", "Cross-workbook reconciliation", "Barcode & SKU matching", "Duplicate detection", "Cost & price variance analysis"] },
      { group: "Business intelligence", items: ["Microsoft Power BI", "Power Query", "KPI modelling", "Executive & multi-location reporting"] },
      { group: "Process automation", items: ["Power Automate", "SharePoint", "Microsoft 365 workflows", "Approval & exception workflows"] },
      { group: "Retail & FMCG systems", items: ["Multi-store master data", "Supplier & DC data flows", "EDI concepts", "AS400-linked information", "Product hierarchy & barcode mapping"] },
      { group: "Data governance", items: ["Accuracy, completeness, consistency", "Uniqueness, validity, timeliness", "Lineage & source ownership", "Audit trails & exception management"] },
      { group: "Commercial analytics", items: ["Gross profit & margin variance", "Promotional profitability", "Supplier claims", "Stock movement, waste & shrinkage"] },
    ],
    developing: ["SQL", "Python & Pandas", "Advanced DAX", "Data engineering", "API integration", "Dataverse", "Power Apps", "AI Builder", "Copilot Studio"],
    responsibilities: [
      "Business problem discovery",
      "Data-quality investigation",
      "Requirements translation",
      "Analytical frameworks",
      "Reporting implementation",
      "Governance improvement",
      "Automation opportunity identification",
    ],
    links: [],
    headshot: null,
    needsConfirmation: ["Full public name", "Headshot", "LinkedIn / professional links", "Employer naming policy (currently unnamed)"],
  },
];

export const founderById = (id: FounderId) => founders.find((f) => f.id === id)!;
