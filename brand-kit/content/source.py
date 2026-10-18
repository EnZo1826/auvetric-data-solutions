"""Auvetric marketing copy — single source of truth.

Every field carries its platform limit. tools/build_content.py writes the markdown handbooks and FAILS
if any field exceeds its limit or contains a banned claim pattern. Edit copy here, then rebuild.

Placeholders in {BRACES} are business details the owners must supply (prices, email, phone).
WEBSITE defaults to the live GitHub Pages address until auvetric.com is connected.
"""

WEBSITE = "https://enzo1826.github.io/auvetric-data-solutions/"
FUTURE_DOMAIN = "auvetric.com"

# (text, limit, source-of-limit). limit=None means no hard platform limit (style limit noted instead).
F = lambda text, limit, src: {"text": text.strip(), "limit": limit, "src": src}

# ── Messaging framework ───────────────────────────────────────────────────────────────────────────
MESSAGING = {
    "positioning": F("""
Auvetric Data Solutions is a two-partner technology consultancy in Windhoek, Namibia. Jakes9NA engineers the systems: software, industrial IoT, ERP integrations and the infrastructure underneath. Alex makes sure the data those systems produce is accurate, reconciled and useful: Power BI, data quality and governance. Most consultancies do one or the other. We do both, so the system that captures the data and the report that depends on it are designed together.
""", None, "internal"),
    "tagline_primary": F("We connect systems. We engineer intelligence.", None, "brand"),
    "tagline_short": F("Engineering × Data × Intelligence", None, "brand"),
    "boilerplate_25": F("""
Auvetric Data Solutions connects operational systems and makes their data trustworthy: custom software, industrial IoT, Power BI, data quality and automation, from Windhoek, Namibia.
""", 220, "style: ~25 words"),
    "boilerplate_50": F("""
Auvetric Data Solutions is a technology consultancy in Windhoek, Namibia. We build custom software, connect industrial equipment and ERP systems, and turn the resulting data into reporting people can trust. One partner engineers the systems; the other is a data and BI specialist. We work with clients locally, regionally and remotely.
""", 420, "style: ~50 words"),
    "boilerplate_100": F("""
Auvetric Data Solutions is a two-partner technology consultancy based in Windhoek, Namibia, working with local, regional and international clients.

Jakes9NA leads engineering: custom and offline-first applications, ERPNext/Frappe, Node-RED and MQTT, industrial PLC and sensor integration, and Linux/AWS infrastructure. Alex leads data and business intelligence, drawing on roughly four years of retail and FMCG operations experience: Power BI, reconciliation, master-data quality and governance.

We offer four practices: Engineering & Development, Data & Business Intelligence, Automation & Intelligent Systems, and Technology Consultancy & Integration. Engagements can cover a single phase, such as a discovery assessment, or a complete build.
""", 900, "style: ~100 words"),
    "elevator_pitch": F("""
You know the problem: the equipment logs one number, the ERP says another, and the monthly report nobody quite trusts sits on top of both. We fix that end to end. I build and connect the systems; my partner makes sure the data coming out of them is right and turns it into reporting you can act on.
""", None, "spoken, ~30 seconds"),
}

VOICE = [
    ("Plain over impressive", "Say what the system does and what problem it removes. 'Captures every fuel dispense, even offline' beats 'next-generation intelligent fuel platform'."),
    ("Specific over general", "Name the technology, the data, the failure mode. Specifics are our proof because we don't publish client names."),
    ("Calm and precise", "Confident, never loud. No exclamation marks in professional copy. No 'revolutionary', 'cutting-edge', 'world-class', 'seamless'."),
    ("Honest about status", "Prototype is prototype. Concept is concept. We never invent clients, results, testimonials, certifications or years of experience."),
    ("Two voices, one brand", "Engineering content can use the blue accent; data content the cyan. Joint content uses both. All of it sounds like the same company."),
]

CLAIMS = {
    "allowed": [
        "Partner skills and technologies listed on the website (each partner's own).",
        "Alex: approximately four years of business operations and retail experience, including participation in an enterprise retail system conversion within a major Namibian FMCG environment (employer not named).",
        "Interactive demonstrations on the website, described as synthetic simulations.",
        "Project types the partners have worked on, described without client names, figures or confidential detail.",
    ],
    "never": [
        "Client names, logos or testimonials without written permission.",
        "Percentages, savings, ROI or performance figures that have not been measured and approved.",
        "Certifications, awards, degrees or 'years of experience' not confirmed by the partner concerned.",
        "Employer-owned systems presented as Auvetric work.",
        "Growth areas (SQL, Python/Pandas, advanced DAX, Power Apps, Copilot Studio) presented as established specialisations.",
        "Prices, guarantees or delivery times not agreed by both partners.",
    ],
}

HASHTAGS = {
    "core": ["#Auvetric", "#Namibia", "#Windhoek"],
    "data": ["#PowerBI", "#DataQuality", "#BusinessIntelligence", "#DataGovernance", "#Analytics"],
    "engineering": ["#IndustrialIoT", "#NodeRED", "#MQTT", "#ERPNext", "#SoftwareEngineering"],
    "automation": ["#Automation", "#PowerAutomate", "#DigitalTransformation"],
}

# ── LinkedIn ──────────────────────────────────────────────────────────────────────────────────────
LINKEDIN = {
    "company_name": F("Auvetric Data Solutions", 100, "LinkedIn Page name"),
    "company_tagline": F("We connect systems and engineer intelligence: custom software, industrial IoT, Power BI and data quality.", 120, "LinkedIn tagline, 120"),
    "company_about": F("""
Auvetric Data Solutions is a technology consultancy in Windhoek, Namibia. We help organisations connect equipment, operational applications and enterprise systems, and then make the data those systems produce accurate and useful.

Two partners, two disciplines:
• Jakes9NA engineers the systems: custom and offline-first applications, ERPNext/Frappe, Node-RED and MQTT, industrial PLC and sensor integration, and Linux, Docker and AWS infrastructure.
• Alex leads data and business intelligence: Power BI and Power Query, reconciliation, master-data quality and governance, informed by roughly four years in retail and FMCG operations.

We organise our work into four practices:
01 Engineering & Development
02 Data & Business Intelligence
03 Automation & Intelligent Systems
04 Technology Consultancy & Integration

Typical problems we take on: equipment readings that never reach the ERP, field teams losing work when connectivity drops, margin reports nobody trusts, and reconciliation that lives in one person's spreadsheet.

Engagements can be a single phase, such as a discovery assessment or data-quality review, or a complete design-and-build. We work with clients in Namibia, the region and remotely.

Try our interactive solution demos (synthetic data): """ + WEBSITE, 2000, "LinkedIn About, 2000"),
    "company_specialties": F("Custom software, Industrial IoT, ERPNext, Frappe, Node-RED, MQTT, Power BI, Data quality, Data governance, Reconciliation, Business process automation, Power Automate, Systems integration, Offline-first PWAs", 256, "LinkedIn specialties (comma list)"),
    "jakes_headline": F("Co-founder, Auvetric Data Solutions | Systems engineering & software: industrial IoT, ERPNext/Frappe, Node-RED/MQTT, offline-first apps", 220, "LinkedIn headline, 220"),
    "jakes_about": F("""
I build systems that have to keep working in real conditions: remote sites, intermittent connectivity, shift work and equipment that can't wait for a perfect network.

My work runs from the field device to the dashboard. Industrial PLCs and sensors, edge gateways, MQTT, backend services, ERPNext integrations and the offline-first applications people use every day, plus the Linux, Docker and AWS infrastructure underneath.

I co-founded Auvetric Data Solutions with Alex, a data and BI specialist, because the two halves belong together. A system that captures data badly produces reports nobody trusts, and a good report can't fix bad capture. We design both at once.

What I care about: working systems over elegant diagrams, failure that is visible instead of silent, and keeping the operator in control.

Interactive demos of how we approach industrial monitoring and data integrity: """ + WEBSITE, 2600, "LinkedIn About, 2600"),
    "alex_headline": F("Co-founder, Auvetric Data Solutions | Enterprise data, Power BI & business process optimisation | Retail & FMCG data integrity", 220, "LinkedIn headline, 220"),
    "alex_about": F("""
A dashboard is only as trustworthy as the data underneath it. I start with where the information comes from, who owns it and how it goes wrong, and only then report on it.

I have roughly four years of business operations and retail experience, covering enterprise data administration, operational reporting, commercial analytics and multi-location systems. That includes taking part in an enterprise retail system conversion and data centralisation within a major Namibian FMCG environment.

My day-to-day toolkit: Power BI and Power Query, advanced Excel modelling, cross-source reconciliation, barcode and SKU matching, pricing and cost variance analysis, and Power Automate and SharePoint workflows. I'm currently developing SQL, Python/Pandas and advanced DAX.

I co-founded Auvetric Data Solutions with Jakes9NA, a systems engineer, so clients get the data discipline and the engineering in one team.

See our data-integrity demo (synthetic data): """ + WEBSITE, 2600, "LinkedIn About, 2600"),
}

# ── Short bios ────────────────────────────────────────────────────────────────────────────────────
BIOS = {
    "facebook_intro": F("We connect systems and engineer intelligence: software, IoT, Power BI & data quality. Windhoek.", 101, "Facebook Page Intro, 101"),
    "instagram_bio": F("We connect systems. We engineer intelligence.\nSoftware · Industrial IoT · Power BI · Data quality\nWindhoek, Namibia", 150, "Instagram bio, 150"),
    "tiktok_bio": F("Engineering × Data × Intelligence.\nIoT, Power BI & data quality explained.", 80, "TikTok bio, 80 (conservative; newer accounts allow more)"),
    "x_bio": F("We connect systems. We engineer intelligence. Custom software, industrial IoT, Power BI and data quality from Windhoek, Namibia.", 160, "X bio, 160"),
    "youtube_description": F("""
Auvetric Data Solutions is a technology consultancy in Windhoek, Namibia. On this channel: short explainers on industrial IoT, ERP integration, offline-first software, Power BI and data quality, plus walkthroughs of our interactive solution demos.

Engineering × Data × Intelligence.
Website: """ + WEBSITE, 1000, "YouTube channel description, 1000"),
    "github_bio": F("Auvetric Data Solutions: we connect systems and engineer intelligence. Software, industrial IoT, Power BI and data quality.", 160, "GitHub bio, 160"),
    "whatsapp_about": F("Auvetric Data Solutions: software, IoT, Power BI & data quality.", 139, "WhatsApp Business about, 139"),
}

# ── Upwork ────────────────────────────────────────────────────────────────────────────────────────
UPWORK = {
    "agency_name": F("Auvetric Data Solutions", 100, "Upwork agency name"),
    "agency_tagline": F("Custom software, industrial IoT & Power BI on data you can trust", 70, "Upwork agency tagline (kept to 70, matching the profile-title limit)"),
    "agency_overview": F("""
Auvetric Data Solutions is a two-partner consultancy in Windhoek, Namibia (UTC+2). We take on the projects where software, equipment and business data meet, and we handle both the engineering and the data.

ENGINEERING (Jakes9NA)
• Custom web apps and offline-first PWAs for field teams
• ERPNext / Frappe customisation, doctypes, workflows and integrations
• Node-RED and MQTT flows, Modbus, industrial PLC and sensor integration
• Telemetry dashboards with alarms, buffering and reconnection handling
• Linux, Docker, nginx and AWS deployment

DATA & BI (Alex)
• Power BI dashboards and Power Query models
• Data cleansing, duplicate detection and master-data matching
• Reconciliation across supplier, ERP and store data
• Pricing, cost and margin variance analysis
• Power Automate and SharePoint workflows

HOW WE WORK
1. Short discovery call to understand the problem and the systems involved.
2. Written proposal with scope, milestones and what we need from you.
3. Working increments you can review, not a big reveal at the end.
4. Documentation and handover so your team can run it.

We are clear about what we've built and what we're exploring. AI-agent and local-LLM work is offered as a prototype or controlled pilot unless agreed otherwise.

Try our interactive industrial-monitoring and data-integrity demos (synthetic data): """ + WEBSITE, 5000, "Upwork overview, 5000"),
    "specialized_profiles": [
        {"title": F("Power BI & Data Quality Consultant: Reconciliation, Dashboards", 70, "Upwork title, 70"),
         "overview": F("""
I build Power BI reporting on data that has been checked first. Most dashboard problems start upstream: duplicate products, wrong case packs, unit costs that don't match the supplier, prices that differ between stores. I find and fix those, then model the KPIs.

Typical work: Power Query cleansing, cross-source reconciliation, exception reports with owners, margin and cost variance analysis, and executive dashboards.

Background: around four years in retail and FMCG operations, including an enterprise system conversion and data centralisation.
""", 5000, "Upwork specialized overview")},
        {"title": F("Industrial IoT & Node-RED Engineer: MQTT, PLC, Telemetry Dashboards", 70, "Upwork title, 70"),
         "overview": F("""
I connect equipment to software that operators can rely on. PLC and sensor acquisition, Modbus, edge buffering for unreliable links, MQTT transport, backend ingest and dashboards that show both the reading and how old it is.

I design for the failure cases: sensor faults flagged as faults rather than real values, store-and-forward during outages, safe re-sync, and alarms with delays and hysteresis so operators aren't buried in noise.

Stack: Node-RED, MQTT, Raspberry Pi and Industrial Shields PLCs, ESP32-S3, Python, Node.js, Docker.
""", 5000, "Upwork specialized overview")},
        {"title": F("ERPNext & Frappe Developer: Custom Apps, Integrations, Reports", 70, "Upwork title, 70"),
         "overview": F("""
I customise ERPNext the Frappe way: custom apps, doctypes, hooks, server scripts, script reports and branded Jinja print formats, without editing core, so upgrades stay safe.

I also build the operational apps that post into ERPNext reliably, including offline-first PWAs for gates, field teams and remote sites, with conflict-aware synchronisation.

Versions: ERPNext v15 and v16.
""", 5000, "Upwork specialized overview")},
    ],
    "project_catalog": [
        {"title": F("Power BI dashboard built on cleansed, reconciled data", 75, "Upwork Project Catalog title (kept ≤75)"),
         "summary": F("You send your exports; I profile, cleanse and reconcile them, then build a Power BI report with documented KPIs and a data-quality page.", 1200, "description"),
         "tiers": ["Starter: one data source, one report page, data-quality summary", "Standard: up to three sources reconciled, three report pages, exception list", "Advanced: multi-source model, scheduled refresh setup guidance, handover session"],
         "cover": "social/upwork/project-cover-02-data-2000x1500.png"},
        {"title": F("Node-RED + MQTT telemetry dashboard for your equipment", 75, "Upwork Project Catalog title"),
         "summary": F("Readings from your PLC, Modbus device or sensors delivered over MQTT to a live dashboard with alarms, stale-data indication and offline buffering.", 1200, "description"),
         "tiers": ["Starter: up to 5 tags, live dashboard", "Standard: up to 20 tags, alarms, history", "Advanced: edge buffering, re-sync, deployment on your server"],
         "cover": "social/upwork/project-cover-01-engineering-2000x1500.png"},
        {"title": F("Business process automation with Power Automate or Node-RED", 75, "Upwork Project Catalog title"),
         "summary": F("I map one manual workflow, then automate it with validation, retries, an approval step where a person must decide, and logging so nothing fails silently.", 1200, "description"),
         "tiers": ["Starter: one simple flow", "Standard: flow with approval step and error handling", "Advanced: multi-system flow with audit log and documentation"],
         "cover": "social/upwork/project-cover-03-automation-2000x1500.png"},
        {"title": F("Systems and data assessment with a costed roadmap", 75, "Upwork Project Catalog title"),
         "summary": F("A structured review of your systems, integrations and data quality, ending in a written current-state map, risk list and phased roadmap.", 1200, "description"),
         "tiers": ["Starter: one system or data area", "Standard: up to three systems and their integrations", "Advanced: full current-state map, data profile, target architecture"],
         "cover": "social/upwork/project-cover-04-technology-consultancy-2000x1500.png"},
    ],
}

# ── Fiverr ────────────────────────────────────────────────────────────────────────────────────────
FIVERR = {
    "seller_description": F("""
We're Auvetric Data Solutions, a two-person consultancy in Windhoek, Namibia. Jakes9NA builds and connects systems: custom software, ERPNext, Node-RED, MQTT and industrial IoT. Alex specialises in data: Power BI, data cleansing, reconciliation and governance. We check the data before we chart it, design for failure cases, and document what we deliver. Message us with your systems and goal and we'll tell you honestly whether we're the right fit.
""", 600, "Fiverr seller description, 600"),
    "gigs": [
        {"title": F("I will build a Power BI dashboard on cleaned and reconciled data", 80, "Fiverr gig title, 80"),
         "tags": ["power bi", "power bi dashboard", "data cleaning", "power query", "data analysis"],
         "description": F("""
Your dashboard is only as good as the data behind it. Before building anything I check your data for duplicates, missing values, mismatched IDs and inconsistent prices or costs, and I tell you what I found.

What you get:
• Data profiling summary (what's wrong and how much)
• Cleansing and transformation in Power Query (repeatable)
• Reconciliation across your sources where needed
• A Power BI report with the KPIs you need
• A data-quality page showing what was fixed and what still needs a person

Good fit for: retail and FMCG data, sales and margin reporting, inventory, supplier and pricing analysis.

Please send sample exports (anonymised is fine) and the questions the report must answer before ordering.
""", 1200, "Fiverr gig description, 1200"),
         "image": "social/fiverr/gig-power-bi-dashboard-1280x769.png"},
        {"title": F("I will clean, deduplicate and reconcile your product and supplier data", 80, "Fiverr gig title, 80"),
         "tags": ["data cleaning", "excel", "data reconciliation", "deduplication", "master data"],
         "description": F("""
Same product, different barcodes, descriptions and costs depending on which system you ask? I fix that.

I work through your product, supplier and pricing data in stages: profile, standardise, match, validate against your business rules, then reconcile. Every change is recorded with the rule that caused it, so you can trust and audit the result.

What you get:
• Cleaned dataset (Excel or CSV)
• Change log: original value, new value and reason
• Exception list of the items a person must decide on
• Summary of duplicates, mismatches and cost or price variances

Retail and FMCG data is my background. Never auto-merging on description alone is one of my rules.
""", 1200, "Fiverr gig description, 1200"),
         "image": "social/fiverr/gig-data-cleansing-reconciliation-1280x769.png"},
        {"title": F("I will build a Node-RED and MQTT telemetry dashboard for your devices", 80, "Fiverr gig title, 80"),
         "tags": ["node red", "mqtt", "iot dashboard", "modbus", "industrial iot"],
         "description": F("""
I connect your PLCs, Modbus devices or sensors to a dashboard operators can rely on.

What you get:
• Node-RED flows for acquisition and processing
• MQTT topic design with retained last-known state
• Dashboard showing live values and data age
• Threshold alarms with delay and hysteresis
• Optional: edge buffering so readings survive network outages

I design for the failure cases: a disconnected sensor shows as a fault rather than a fake reading, and a network drop doesn't create gaps in your history.

Before ordering, tell me your devices, protocols, how many tags and where it should run.
""", 1200, "Fiverr gig description, 1200"),
         "image": "social/fiverr/gig-iot-telemetry-dashboard-1280x769.png"},
        {"title": F("I will customise ERPNext and Frappe with custom apps and integrations", 80, "Fiverr gig title, 80"),
         "tags": ["erpnext", "frappe", "erpnext developer", "erp customization", "python"],
         "description": F("""
I customise ERPNext without breaking upgrades: custom Frappe apps, doctypes, hooks, server scripts, script reports and branded Jinja print formats. I don't edit core.

I can also connect your operational apps to ERPNext through its REST API, including offline-first apps that sync reliably when connectivity returns.

Typical requests:
• Custom doctype and workflow for a process ERPNext doesn't cover
• Branded print format (invoice, delivery note, report)
• Script report or dashboard
• Integration with an external app or device data

ERPNext v15 and v16. Please share your version, hosting and a short description of the process before ordering.
""", 1200, "Fiverr gig description, 1200"),
         "image": "social/fiverr/gig-erpnext-frappe-1280x769.png"},
    ],
}

# ── Email signature ──────────────────────────────────────────────────────────────────────────────
EMAIL_SIGNATURE = {
    "jakes": ["Jakes9NA", "Co-founder · Systems Engineering & Software Development", "Auvetric Data Solutions", "{EMAIL} · {PHONE}", WEBSITE],
    "alex": ["Alex", "Co-founder · Enterprise Data, BI & Process Optimisation", "Auvetric Data Solutions", "{EMAIL} · {PHONE}", WEBSITE],
}
