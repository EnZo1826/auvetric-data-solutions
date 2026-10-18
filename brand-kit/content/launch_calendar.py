"""Four-week launch calendar. Every post maps to an asset in social/ and a campaign objective.

Status for every slot is "draft — needs owner approval": nothing here is published.
Character limits: LinkedIn post 3000, Instagram caption 2200, Facebook 63206, TikTok caption 2200, X 280.
"""
from source import WEBSITE, HASHTAGS

H = lambda *groups: " ".join(dict.fromkeys(t for g in groups for t in HASHTAGS[g]))

OBJECTIVES = {
    "awareness": "Announce the agency and make the name recognisable.",
    "positioning": "Explain why engineering + data in one team matters.",
    "proof": "Show how we think, using the website demos (labelled synthetic) instead of invented case studies.",
    "lead": "Drive discovery calls and marketplace enquiries.",
}

POSTS = [
    # ── Week 1: launch ──
    {"week": 1, "day": "Mon", "objective": "awareness", "asset": "social/instagram/post-01-introducing-1080x1350.png",
     "alt": "Auvetric Data Solutions logo above the headline 'We connect systems. We engineer intelligence.' with blue and cyan signal paths converging on a glowing node.",
     "copy": {
        "linkedin": f"""Today we're launching Auvetric Data Solutions.

We're a two-partner technology consultancy in Windhoek. Jakes9NA engineers the systems: custom software, ERPNext, Node-RED, MQTT and industrial IoT. Alex makes the data trustworthy: Power BI, reconciliation, data quality and governance.

Most projects we see fail at the join between those two. The system captures data one way, the report assumes another, and nobody owns the gap. We design both sides together.

Four practices: Engineering & Development, Data & Business Intelligence, Automation & Intelligent Systems, and Technology Consultancy & Integration.

Website and interactive demos: {WEBSITE}

{H('core')}""",
        "instagram": f"""Introducing Auvetric Data Solutions.

We connect systems. We engineer intelligence.

Two partners, two disciplines, one team: systems engineering and data & BI, based in Windhoek, Namibia.

Link in bio.

{H('core', 'data')}""",
        "facebook": f"""Auvetric Data Solutions is open for projects.

We build custom software, connect industrial equipment and ERP systems, and turn the data into reporting people can trust. Two partners: one engineers the systems, the other is a data and BI specialist.

Have a look at our interactive demos: {WEBSITE}""",
        "x": f"Introducing Auvetric Data Solutions. We connect systems and engineer intelligence: custom software, industrial IoT, Power BI and data quality, from Windhoek. {WEBSITE}",
     }},
    {"week": 1, "day": "Wed", "objective": "positioning", "asset": "social/instagram/post-02-two-disciplines-1080x1350.png",
     "alt": "Card titled 'Engineering meets data.' listing Jakes9NA for systems engineering, Alex for enterprise data and Power BI, and 'Together: systems that run, and numbers you can trust'.",
     "copy": {
        "linkedin": f"""Why two disciplines in one small team?

Because the failure point is usually between them.

An engineer builds a field app that captures fuel dispenses. A BI analyst later builds a margin report on that data. Nobody agreed what counts as one dispense, which record wins when the meter and the ERP disagree, or what happens to readings taken offline.

At Auvetric, those questions get answered while the system is being designed, not when the report looks wrong.

Jakes9NA: systems engineering, IoT, ERP integration, infrastructure.
Alex: enterprise data, Power BI, reconciliation, governance.

{H('core')} #DataQuality #SystemsIntegration""",
        "instagram": f"""Engineering meets data.

Jakes9NA builds and connects the systems. Alex makes sure what they produce is accurate and useful. Together: systems that run, and numbers you can trust.

{H('core', 'engineering')}""",
     }},
    {"week": 1, "day": "Fri", "objective": "awareness", "asset": "social/instagram/story-launch-1080x1920.png",
     "alt": "Story graphic: 'Now open for projects. We connect systems. We engineer intelligence.' Services listed: custom software, industrial IoT, Power BI, data quality, automation.",
     "copy": {"instagram_story": "Add a link sticker to the website. Sticker text: 'See our demos'.", "facebook_story": "Same asset; add link sticker."}},

    # ── Week 2: services ──
    {"week": 2, "day": "Mon", "objective": "positioning", "asset": "social/instagram/post-03-four-practices-1080x1350.png",
     "alt": "Card titled 'Four practices. One connected capability.' listing Engineering & Development, Data & Business Intelligence, Automation & Intelligent Systems, Technology Consultancy & Integration.",
     "copy": {
        "linkedin": f"""What we actually do, in four practices:

01 Engineering & Development: custom and offline-first software, ERPNext/Frappe, industrial IoT and edge systems.
02 Data & Business Intelligence: Power BI, data quality, reconciliation and governance.
03 Automation & Intelligent Systems: Node-RED, Power Automate, integration workflows, and AI used where it can be controlled.
04 Technology Consultancy & Integration: discovery, architecture and a costed roadmap before you commit to a platform.

You can engage one phase or a whole project. {WEBSITE}

{H('core')}""",
        "instagram": f"""Four practices. One connected capability.

01 Engineering & Development
02 Data & Business Intelligence
03 Automation & Intelligent Systems
04 Technology Consultancy & Integration

{H('core', 'automation')}""",
     }},
    {"week": 2, "day": "Wed", "objective": "proof", "asset": "social/tiktok/video-cover-sensor-to-dashboard-1080x1920.png",
     "alt": "Video cover: 'From sensor to dashboard in 8 steps.' Engineering episode 01.",
     "copy": {"tiktok": f"A pressure reading's journey from sensor to decision, and what goes wrong at each step. Demo is a simulation on our site. {H('core', 'engineering')}",
              "instagram_reel": f"From sensor to dashboard in 8 steps, and the failure you have to design for at each one. Simulation on our website (link in bio). {H('core', 'engineering')}",
              "linkedin_video": "Sensor → PLC → edge → MQTT → API → database → analytics → decision. Each hop has a failure mode; here's how a well-built system handles them. (Synthetic demo from our website.)"},
     "script": "sensor-to-dashboard"},
    {"week": 2, "day": "Fri", "objective": "positioning", "asset": "social/instagram/post-04-data-principle-1080x1350.png",
     "alt": "Quote card: 'A dashboard is only as trustworthy as the data underneath it.' attributed to Alex, Data and BI.",
     "copy": {
        "linkedin": f"""A dashboard is only as trustworthy as the data underneath it.

Before I build a report, I want to know three things: where each number comes from, who owns that source, and how it can go wrong. In retail data the usual suspects are duplicate barcodes, case packs that differ between supplier and store, and unit costs that don't match the invoice.

Fix those first, then report. (Alex)

{H('core', 'data')}""",
        "instagram": f"""A dashboard is only as trustworthy as the data underneath it.

Start with where the information comes from, who owns it and how it can go wrong. Then report on it. (Alex)

{H('core', 'data')}""",
     }},

    # ── Week 3: proof ──
    {"week": 3, "day": "Mon", "objective": "proof", "asset": "social/tiktok/video-cover-duplicate-barcodes-1080x1920.png",
     "alt": "Video cover: 'One product. Five barcodes. Now what?' Data and BI episode 02.",
     "copy": {"tiktok": f"Same product, different barcodes, costs and descriptions in every system. Here's the order we fix it in. {H('core', 'data')}",
              "instagram_reel": f"One product, five barcodes. The seven stages we use to turn messy product data into something you can report on. {H('core', 'data')}"},
     "script": "duplicate-barcodes"},
    {"week": 3, "day": "Wed", "objective": "proof", "asset": "social/instagram/story-lab-1080x1920.png",
     "alt": "Story graphic: 'Explore how our solutions work.' Interactive demos: industrial monitoring and data-integrity simulations.",
     "copy": {
        "linkedin": f"""We'd rather show you how we think than list buzzwords.

Our website has three interactive demos, all running on synthetic data:
• A solution architecture lab: click any stage of an industrial, data-integrity or automation pipeline to see its inputs, outputs and failure modes.
• An industrial monitoring simulation: trigger a threshold alarm, a sensor fault or a network outage, and watch the edge buffer and back-fill.
• A data-integrity pipeline: 18 messy product records through seven stages, with every figure reproducible.

Try them: {WEBSITE}

{H('core')}""",
        "instagram_story": "Link sticker to the website lab page. Sticker text: 'Try the demos'.",
     }},
    {"week": 3, "day": "Fri", "objective": "positioning", "asset": "social/instagram/post-05-engineering-principle-1080x1350.png",
     "alt": "Quote card: 'Design for the conditions the system will actually face.' attributed to Jakes9NA, Systems Engineering.",
     "copy": {
        "linkedin": f"""Design for the conditions the system will actually face.

On a remote site, connectivity drops, power blips and sensors fail. If the app assumes a perfect network, the first outage loses data and the second loses trust.

So the defaults are: write locally first, buffer and forward, make stale data visibly stale, and treat "no reading" as an alarm, not a blank chart. (Jakes9NA)

{H('core', 'engineering')}""",
        "instagram": f"""Design for the conditions the system will actually face.

Intermittent connectivity, remote sites and shift work are requirements, not edge cases. (Jakes9NA)

{H('core', 'engineering')}""",
     }},

    # ── Week 4: process + lead ──
    {"week": 4, "day": "Mon", "objective": "lead", "asset": "social/instagram/post-06-how-we-work-1080x1350.png",
     "alt": "Card titled 'From complexity to clarity.' listing seven stages: Discover, Investigate, Architect, Engineer, Validate, Deploy, Improve.",
     "copy": {
        "linkedin": f"""How an engagement with us runs:

01 Discover: the operation, people, systems and constraints.
02 Investigate: source data, interfaces and dependencies.
03 Architect: a target design you can review and cost.
04 Engineer: working increments, not a big reveal.
05 Validate: data checks, error handling and acceptance.
06 Deploy: configuration, documentation and handover.
07 Improve: controlled changes once it's running.

Many clients start with just 01–03: a discovery assessment and roadmap before committing to a build. If that sounds useful, message us. {WEBSITE}

{H('core')}""",
        "instagram": f"""From complexity to clarity. Seven stages, led by whichever discipline the stage needs. Start with one phase or the whole project.

{H('core')}""",
     }},
    {"week": 4, "day": "Wed", "objective": "proof", "asset": "social/tiktok/video-cover-why-your-margin-report-is-wrong-1080x1920.png",
     "alt": "Video cover: 'Why your margin report might be wrong.' Data and BI episode 01.",
     "copy": {"tiktok": f"If the unit cost in your ERP doesn't match supplier case cost ÷ case pack, your margin report is wrong. Here's how to check. {H('core', 'data')}",
              "instagram_reel": f"Why your margin report might be wrong, and the one calculation to check first. {H('core', 'data')}"},
     "script": "margin-report"},
    {"week": 4, "day": "Fri", "objective": "proof", "asset": "social/tiktok/video-cover-offline-first-1080x1920.png",
     "alt": "Video cover: 'Field apps that don't lose data offline.' Engineering episode 02.",
     "copy": {"tiktok": f"Your gate app loses entries when the signal drops? It doesn't have to. Offline-first in 45 seconds. {H('core', 'engineering')}",
              "instagram_reel": f"Field apps that don't lose data offline: local-first writes, a sync queue and safe retries. {H('core', 'engineering')}",
              "linkedin_video": "Offline-first, explained in under a minute: write locally first, queue for sync, retry safely, and let the server reconcile IDs later."},
     "script": "offline-first"},
]

SCRIPTS = {
    "sensor-to-dashboard": {"length": "45–60s", "screen": "Screen-record the Architecture Lab on the website (Industrial Intelligence). Label 'Synthetic demo' visible.", "beats": [
        "HOOK (0–3s): 'A pressure reading takes eight steps to become a decision. Each one can break.'",
        "Sensor & PLC (3–12s): 'The sensor sends 4–20 milliamps. Below 3.8, the wire's broken, so we flag a fault and never log a fake zero.'",
        "Edge & MQTT (12–25s): 'The edge buffers when the network drops, then forwards over MQTT. Duplicates after reconnect get removed on arrival.'",
        "API & database (25–38s): 'The API rejects readings with impossible timestamps. Late data lands where it belongs in history.'",
        "Dashboard & decision (38–50s): 'The dashboard shows the value and how old it is. A person acknowledges the alarm, and that's logged.'",
        "CTA (50–60s): 'Click through it yourself. Link in bio. Auvetric: we connect systems.'"]},
    "duplicate-barcodes": {"length": "45–60s", "screen": "Screen-record the Data Integrity demo stepping from Raw → Profiling → Matching.", "beats": [
        "HOOK (0–3s): 'One product, five barcodes. Which one is right?'",
        "Profile (3–15s): 'First, measure. How many barcodes are shared, how many fail the check digit, how many ways is each supplier spelled?'",
        "Match (15–30s): 'Same barcode and same supplier code means a duplicate to merge. Same barcode on a different product is a collision. Never auto-merge that.'",
        "Validate (30–45s): 'Then the business rules: does case cost ÷ case pack equal the unit cost? Is the margin plausible?'",
        "CTA (45–60s): 'Every change gets a reason code. Try it on our site, with synthetic data. Auvetric: we engineer intelligence.'"]},
    "margin-report": {"length": "30–45s", "screen": "Talking head or screen-record of the Reconciliation stage in the demo.", "beats": [
        "HOOK (0–3s): 'Your margin report might be wrong, and it's probably one calculation.'",
        "Point (3–20s): 'Supplier case cost ÷ case pack should equal the unit cost in your ERP. If the pack size is wrong in one system, every margin on that product is wrong.'",
        "Example (20–35s): 'In our demo, one product's ERP cost is N$19.83 too low. At 310 a week, that overstates margin by about N$6,100 a week. Synthetic numbers, real pattern.'",
        "CTA (35–45s): 'Check your top 20 products first. Want help? Link in bio.'"]},
    "offline-first": {"length": "30–45s", "screen": "Phone footage of a gate or field app, or slides using brand cards.", "beats": [
        "HOOK (0–3s): 'If your field app loses data when the signal drops, it was built for the office.'",
        "Point (3–25s): 'Offline-first means the device writes locally first, queues every record, and syncs when the network comes back. Each record has an ID, so a retry never creates a duplicate.'",
        "Why (25–38s): 'At a gate, the server should never be in the way of the guard.'",
        "CTA (38–45s): 'We build these. Auvetric: we connect systems.'"]},
}
