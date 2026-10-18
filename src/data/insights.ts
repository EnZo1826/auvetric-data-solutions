export interface Insight {
  slug: string;
  title: string;
  summary: string;
  discipline: "engineering" | "data" | "unified";
  status: "proposed" | "drafting" | "published";
  author: ("jakes" | "alex")[];
  body?: string[]; // paragraphs, only once written and approved
  publishedAt?: string;
}

/** Proposed topics. Only items with status "published" and a body render as full articles. */
export const insights: Insight[] = [
  { slug: "data-integrity-multi-store-retail", title: "Understanding data integrity in multi-store retail environments", summary: "Why the same product can have five truths, and how to decide which one wins.", discipline: "data", status: "proposed", author: ["alex"] },
  { slug: "resilient-offline-first-applications", title: "Building resilient offline-first operational applications", summary: "Local-first storage, sync queues and conflict handling for sites with unreliable connectivity.", discipline: "engineering", status: "proposed", author: ["jakes"] },
  { slug: "plcs-to-cloud-dashboards", title: "Connecting industrial PLCs to cloud dashboards", summary: "Acquisition, edge buffering, MQTT topic design and showing operators how old their data is.", discipline: "engineering", status: "proposed", author: ["jakes"] },
  { slug: "reliable-automation-workflows", title: "Designing reliable business automation workflows", summary: "Validation, retries, idempotency and the human approval step automation should never skip.", discipline: "unified", status: "proposed", author: ["jakes", "alex"] },
  { slug: "local-ai-in-business-software", title: "Practical uses of local AI in business software", summary: "Where local models are useful today, where they are not, and how to keep them under control.", discipline: "engineering", status: "proposed", author: ["jakes"] },
  { slug: "supplier-data-reconciliation-problems", title: "Common problems in supplier data reconciliation", summary: "Case packs, barcode variants, cost units and the other quiet causes of margin leakage.", discipline: "data", status: "proposed", author: ["alex"] },
  { slug: "erp-and-operational-applications", title: "Connecting ERP systems with operational applications", summary: "Keeping the ERP as the system of record while field applications do the capturing.", discipline: "unified", status: "proposed", author: ["jakes", "alex"] },
  { slug: "planning-industrial-monitoring", title: "How to plan an industrial monitoring project", summary: "The questions to answer before buying a single sensor.", discipline: "unified", status: "proposed", author: ["jakes", "alex"] },
];
