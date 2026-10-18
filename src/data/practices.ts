export type Accent = "eng" | "data" | "converge";
export type OfferingStatus = "deliverable" | "assessed" | "exploratory";

export interface CapabilityArea {
  name: string;
  offerings: { label: string; status?: OfferingStatus }[];
}

export interface Practice {
  slug: string;
  index: string;
  name: string;
  short: string;
  summary: string;
  accent: Accent;
  lead: ("jakes" | "alex")[];
  problem: { headline: string; points: string[] };
  areas: CapabilityArea[];
  useCases: string[];
  approach: { step: string; detail: string }[];
  architecture: { title: string; nodes: { label: string; side: "eng" | "data" | "core" }[] };
  technologies: string[];
  benefits: string[];
  notes: string[];
  relatedProjects: string[];
  businessLens: string;
  technicalLens: string;
}

export const statusLabel: Record<OfferingStatus, string> = {
  deliverable: "Deliverable now",
  assessed: "Assessed per project",
  exploratory: "Prototype / exploratory",
};

export const practices: Practice[] = [
  {
    slug: "engineering-development",
    index: "01",
    name: "Engineering & Development",
    short: "Custom software, industrial IoT, ERP integrations, edge computing and connected operational systems.",
    summary:
      "We design and build the software and connected systems that run real operations — from a PLC on a remote site to the ERP transaction it eventually becomes.",
    accent: "eng",
    lead: ["jakes"],
    problem: {
      headline: "Operations run on equipment, spreadsheets and systems that don't talk to each other.",
      points: [
        "Equipment readings are logged by hand, late, or not at all.",
        "Off-the-shelf software doesn't fit the way the operation actually works.",
        "Field teams lose work when connectivity drops.",
        "ERP records and what happens on site drift apart.",
      ],
    },
    areas: [
      {
        name: "Custom Software & Enterprise Applications",
        offerings: [
          { label: "Custom web applications" },
          { label: "Business management systems" },
          { label: "ERPNext / Frappe customisation" },
          { label: "Mobile-first, offline-capable PWAs" },
          { label: "Workflow applications" },
          { label: "API development & system integrations" },
        ],
      },
      {
        name: "Industrial IoT & Operational Technology",
        offerings: [
          { label: "Industrial equipment connectivity" },
          { label: "Raspberry Pi edge systems & PLC integration" },
          { label: "Modbus and MQTT communications" },
          { label: "Real-time telemetry & remote monitoring" },
          { label: "Industrial alarms & equipment dashboards" },
          { label: "Embedded controllers (RP2040, ESP32-S3)" },
        ],
      },
      {
        name: "Cloud, Infrastructure & System Integration",
        offerings: [
          { label: "Linux application hosting & AWS deployments" },
          { label: "Docker-based services" },
          { label: "MQTT infrastructure" },
          { label: "Reverse proxy, TLS & secure access" },
          { label: "Monitoring and logging" },
          { label: "Cloud-to-edge connectivity" },
        ],
      },
      {
        name: "Fleet, Security & Remote Operations",
        offerings: [
          { label: "GPS & telematics integrations" },
          { label: "Fleet monitoring dashboards" },
          { label: "Security checkpoint & visitor software" },
          { label: "Camera API integrations" },
          { label: "Dispatch & notification workflows" },
        ],
      },
    ],
    useCases: [
      "Visitor and vehicle checkpoint management",
      "Field service and inspection applications",
      "Fuel and consumable dispensing control",
      "Remote equipment telemetry with alarms",
      "Operational transaction capture feeding ERPNext",
    ],
    approach: [
      { step: "Site & system survey", detail: "Identify the devices, protocols, networks and existing systems in play — and the conditions they operate under." },
      { step: "Reference architecture", detail: "Agree where data is captured, processed, buffered, stored and presented, and what happens when each link fails." },
      { step: "Iterative build", detail: "Deliver working increments against real or simulated equipment, not slideware." },
      { step: "Commissioning & handover", detail: "Deploy, document configuration, and hand over runbooks the operating team can actually use." },
    ],
    architecture: {
      title: "Typical connected-operations stack",
      nodes: [
        { label: "Sensors / PLC", side: "eng" },
        { label: "Edge gateway", side: "eng" },
        { label: "MQTT broker", side: "eng" },
        { label: "API service", side: "core" },
        { label: "Database", side: "core" },
        { label: "Operator app", side: "data" },
        { label: "ERP", side: "data" },
      ],
    },
    technologies: ["Node.js", "Python", "Frappe / ERPNext", "Node-RED", "MQTT", "Modbus", "Raspberry Pi PLCs", "ESP32-S3", "Docker", "nginx", "AWS"],
    benefits: [
      "Reduced manual data capture",
      "Earlier visibility of equipment and process issues",
      "Software that continues working through connectivity loss",
      "Fewer gaps between site activity and business records",
    ],
    notes: [
      "We integrate with third-party telematics and security platforms; we do not claim ownership of those platforms.",
      "Hardware selection and certification requirements are assessed per site.",
    ],
    relatedProjects: ["industrial-fuel-management", "security-checkpoint", "industrial-monitoring-telemetry", "gps-fleet-integrations", "mqtt-led-displays", "erpnext-frappe-applications", "realtime-operational-dashboards"],
    businessLens: "Get reliable information out of equipment and field activity, and into the systems where decisions are made.",
    technicalLens: "PLC/sensor acquisition → edge processing → MQTT → APIs → database → applications, with buffering and recovery at each hop.",
  },
  {
    slug: "data-business-intelligence",
    index: "02",
    name: "Data & Business Intelligence",
    short: "Data quality, Power BI, enterprise reconciliation, analytical reporting, retail/FMCG intelligence and data governance.",
    summary:
      "We establish whether the numbers can be trusted, fix the sources where they can't, and build reporting that management can act on.",
    accent: "data",
    lead: ["alex"],
    problem: {
      headline: "The reports exist. Nobody fully trusts them.",
      points: [
        "Same product, different barcodes, costs and descriptions across systems.",
        "Margin reports disagree with supplier invoices.",
        "Reconciliation lives in personal spreadsheets nobody else can follow.",
        "Exceptions are discovered at month-end — or not at all.",
      ],
    },
    areas: [
      {
        name: "Business Intelligence & Analytics",
        offerings: [
          { label: "Power BI dashboards & Power Query models" },
          { label: "KPI development" },
          { label: "Excel-based analytics" },
          { label: "Pricing & gross-profit analysis" },
          { label: "Multi-location operational reporting" },
          { label: "Management decision-support dashboards" },
        ],
      },
      {
        name: "Data Engineering, Quality & Governance",
        offerings: [
          { label: "Data-quality assessments" },
          { label: "Source-system reconciliation" },
          { label: "Master-data standardisation" },
          { label: "Duplicate identification" },
          { label: "Business-rule validation & exception reporting" },
          { label: "Data lineage documentation" },
          { label: "Data governance frameworks" },
          { label: "Production ETL / ELT pipelines", status: "assessed" },
        ],
      },
    ],
    useCases: [
      "Product master-data reconciliation across supplier, DC and store systems",
      "Promotional pricing and supplier invoice analysis",
      "Gross-profit and claims investigation",
      "Multi-store performance reporting",
    ],
    approach: [
      { step: "Source inventory", detail: "Map every source, its owner, its refresh cycle and the identifiers that join it to everything else." },
      { step: "Profiling", detail: "Measure completeness, uniqueness, validity and consistency before any dashboard is drawn." },
      { step: "Rules & reconciliation", detail: "Codify business rules, reconcile sources, and route exceptions to accountable owners." },
      { step: "Reporting", detail: "Model KPIs on validated data, with lineage visible to the people relying on them." },
    ],
    architecture: {
      title: "Trusted reporting pipeline",
      nodes: [
        { label: "Supplier data", side: "data" },
        { label: "DC records", side: "data" },
        { label: "Retail ERP", side: "data" },
        { label: "Profiling", side: "core" },
        { label: "Validation rules", side: "core" },
        { label: "Reconciliation", side: "core" },
        { label: "Power BI", side: "data" },
      ],
    },
    technologies: ["Power BI", "Power Query", "Excel", "SharePoint", "Power Automate"],
    benefits: [
      "Clear visibility of which data is reliable — and which isn't",
      "Documented, repeatable reconciliation instead of personal spreadsheets",
      "Exceptions surfaced to owners rather than discovered late",
      "Reporting with traceable lineage",
    ],
    notes: [
      "Production-grade ETL/ELT platforms are an expanded capability assessed per engagement, not an established delivery history.",
      "SQL, Python/Pandas and advanced DAX are active development areas.",
    ],
    relatedProjects: ["multi-store-data-centralisation", "master-data-reconciliation", "promotional-pricing-invoice-analysis", "gross-profit-claims-investigation", "fmcg-data-cleansing-framework"],
    businessLens: "Know which numbers to trust, find where money leaks through bad data, and report on it with confidence.",
    technicalLens: "Source profiling → standardisation → keyed matching → rule validation → exception routing → modelled KPIs with lineage.",
  },
  {
    slug: "automation-intelligent-systems",
    index: "03",
    name: "Automation & Intelligent Systems",
    short: "Business process automation, Node-RED, Power Automate, integration workflows and practical AI-assisted applications.",
    summary:
      "We remove repetitive handling between systems and people, and apply AI only where it can be controlled, checked and explained.",
    accent: "converge",
    lead: ["jakes", "alex"],
    problem: {
      headline: "Skilled people spend their days copying data between systems.",
      points: [
        "Approvals happen over email and get lost.",
        "Reports are rebuilt by hand every week.",
        "Events in one system need action in another, and nobody is watching.",
        "AI is on the agenda, but nobody can say where it is safe to use.",
      ],
    },
    areas: [
      {
        name: "Intelligent Automation & AI Integration",
        offerings: [
          { label: "Business workflow automation" },
          { label: "Node-RED integrations" },
          { label: "Power Automate solutions" },
          { label: "n8n workflows" },
          { label: "Event-triggered processes" },
          { label: "Human-in-the-loop approval flows" },
          { label: "Document workflow concepts", status: "assessed" },
          { label: "AI-assisted operational tools", status: "assessed" },
          { label: "Local AI (Ollama) deployments", status: "exploratory" },
          { label: "Controlled agent workflows", status: "exploratory" },
        ],
      },
    ],
    useCases: [
      "Exception alerts routed to the right owner with context",
      "Scheduled report distribution",
      "Approval workflows with audit trail",
      "Device events triggering business actions",
    ],
    approach: [
      { step: "Process mapping", detail: "Document the current workflow, the hand-offs and where errors are introduced." },
      { step: "Automation candidates", detail: "Rank steps by volume, error rate and risk; keep judgement-heavy steps with people." },
      { step: "Controlled build", detail: "Automate with explicit validation, retries, logging and a human override." },
      { step: "Monitor", detail: "Track runs, failures and exceptions so automation never fails silently." },
    ],
    architecture: {
      title: "Event-driven workflow",
      nodes: [
        { label: "Business event", side: "eng" },
        { label: "Integration API", side: "eng" },
        { label: "Validation", side: "core" },
        { label: "Workflow rules", side: "core" },
        { label: "Approval", side: "data" },
        { label: "Notification", side: "data" },
      ],
    },
    technologies: ["Node-RED", "n8n", "Power Automate", "SharePoint", "MQTT", "Ollama", "Claude / OpenAI APIs"],
    benefits: [
      "Less re-keying and fewer transcription errors",
      "Consistent execution of routine processes",
      "Faster response to operational events",
      "AI applied with explicit human control points",
    ],
    notes: [
      "AI-assisted and agent-based workflows are offered as prototypes or controlled pilots unless agreed otherwise.",
      "We will not automate decisions that require accountable human judgement without an approval step.",
    ],
    relatedProjects: ["ai-agent-automation-experiments", "realtime-operational-dashboards", "concept-connected-retail"],
    businessLens: "Free people from repetitive handling, and make sure exceptions reach someone who can act on them.",
    technicalLens: "Event capture → validation → rules engine → approval gate → persistence → notification, with retries and audit logging.",
  },
  {
    slug: "technology-consultancy",
    index: "04",
    name: "Technology Consultancy & Integration",
    short: "Technical discovery, systems architecture, solution planning, process improvement, integration assessments and implementation guidance.",
    summary:
      "Before anything is built, we help you understand what you have, what is actually wrong, and what a sensible path forward costs.",
    accent: "converge",
    lead: ["jakes", "alex"],
    problem: {
      headline: "You know something needs to change. You don't yet know what to build.",
      points: [
        "Vendors propose platforms before anyone has mapped the problem.",
        "Integration risk is invisible until the project is late.",
        "Nobody owns the end-to-end view of systems and data.",
      ],
    },
    areas: [
      {
        name: "Business Process Consultancy",
        offerings: [
          { label: "Requirements discovery" },
          { label: "Operational process mapping" },
          { label: "Systems & integration assessment" },
          { label: "Data maturity assessment" },
          { label: "Automation opportunity identification" },
          { label: "Reporting review" },
          { label: "Solution architecture" },
          { label: "Implementation roadmaps" },
        ],
      },
    ],
    useCases: [
      "Pre-procurement assessment of a proposed platform",
      "Integration plan between ERP and operational systems",
      "Data maturity review before a BI investment",
      "Industrial monitoring project planning",
    ],
    approach: [
      { step: "Discover", detail: "Stakeholder interviews, site visits and system walkthroughs." },
      { step: "Investigate", detail: "Audit processes, source data, infrastructure and dependencies." },
      { step: "Architect", detail: "Propose a target design with constraints, risks and options." },
      { step: "Roadmap", detail: "Phase the work so each step delivers usable value." },
    ],
    architecture: {
      title: "Assessment deliverables",
      nodes: [
        { label: "Current-state map", side: "eng" },
        { label: "Data assessment", side: "data" },
        { label: "Risk register", side: "core" },
        { label: "Target architecture", side: "core" },
        { label: "Phased roadmap", side: "core" },
      ],
    },
    technologies: ["Process mapping", "Architecture diagrams", "Data profiling", "Integration assessment"],
    benefits: [
      "Decisions made on an understood problem",
      "Integration and data risk identified before build",
      "A roadmap sized to budget and capacity",
    ],
    notes: ["Consultancy can be engaged on its own; there is no obligation to build with us afterwards."],
    relatedProjects: ["concept-connected-retail", "concept-industrial-operations", "concept-fleet-operations"],
    businessLens: "A clear, independent view of the problem and a costed path forward before you commit to a platform.",
    technicalLens: "Current-state architecture, interface inventory, data profiling, risk assessment and a phased target design.",
  },
];

export const practiceBySlug = (slug: string) => practices.find((p) => p.slug === slug);
