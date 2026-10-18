"""Auvetric asset catalogue — every platform asset, its exact spec and source of truth.

Run from brand-kit/:  python tools/catalogue.py            (build all)
                      python tools/catalogue.py facebook   (build one platform)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_social as b  # noqa: E402
from brand import C  # noqa: E402

FOUNDERS = {
    "jakes": ("Jakes", "Systems Engineering &amp; Software Development", "eng"),
    "alex": ("Alex", "Enterprise Data, BI &amp; Process Optimisation", "data"),
}
PRACTICES = [
    ("01", "Engineering &amp; Development", "Custom software, industrial IoT, ERP integrations and connected operational systems.", "eng"),
    ("02", "Data &amp; Business Intelligence", "Data quality, Power BI, reconciliation, analytical reporting and governance.", "data"),
    ("03", "Automation &amp; Intelligent Systems", "Process automation, Node-RED, Power Automate and practical AI-assisted tools.", "converge"),
    ("04", "Technology Consultancy &amp; Integration", "Discovery, systems architecture, integration assessment and implementation roadmaps.", "converge"),
]
FOOT = "Auvetric Data Solutions · Windhoek, Namibia"


def facebook():
    b.avatar("facebook", "facebook-profile-720.png", 720, use="Page profile picture", spec="Displays 176px desktop / 196px mobile, circle crop; Meta recommends ≥320×320")
    b.save("facebook", "facebook-cover-1702x630.png", 1702, 630,
           b.banner(1702, 630, text_x=420, text_w=650, node_x=1400, node_r=128, head=64, text_y=.44, logo_h=44),
           use="Page cover photo", spec="Meta: 851×315 recommended (uploaded at 2×). Desktop 16:9 / mobile 2.4:1 crops, left-aligned",
           note="Key content kept clear of the bottom-left profile-picture overlap and the mobile side crop.")


def linkedin():
    b.avatar("linkedin", "linkedin-company-logo-400.png", 400, use="Company Page logo", spec="LinkedIn: 400×400 recommended, min 268×268, ≤3 MB")
    b.save("linkedin", "linkedin-company-cover-1512x256.png", 1512, 256,
           b.banner(1512, 256, text_x=430, text_w=520, node_x=1290, node_r=72, head=38, show_logo=False, eyebrow=True, lanes=4, spread=.95),
           use="Company Page cover", spec="LinkedIn: 1512×256 (current spec, min = recommended), ≤3 MB",
           note="Text sits right of the logo overlap at the lower left.")
    for key, (name, role, tone) in FOUNDERS.items():
        node_x = 1290
        html = b.banner(1584, 396, text_x=520, text_w=560, node_x=node_x, node_r=96, head=52, show_logo=True, logo_h=34, eyebrow=False,
                        sub=f'<span class="{"blue" if tone=="eng" else "cyan"}">{name}</span> · {role}', seed=21 if tone == "eng" else 33, lanes=5, text_y=.5)
        b.save("linkedin", f"linkedin-personal-banner-{key}-1584x396.png", 1584, 396, html,
               use=f"{name} personal profile background", spec="LinkedIn: 1584×396 recommended",
               note="Left 30% left clear for the circular profile photo.")


def x_twitter():
    b.avatar("x", "x-profile-400.png", 400, use="Profile photo", spec="X: 400×400 recommended")
    b.save("x", "x-header-1500x500.png", 1500, 500,
           b.banner(1500, 500, text_x=440, text_w=560, node_x=1290, node_r=104, head=54, logo_h=36, text_y=.47),
           use="Header", spec="X: 1500×500 recommended", note="Profile photo overlaps lower left; content starts at 31% width.")


def youtube():
    b.avatar("youtube", "youtube-avatar-800.png", 800, use="Channel picture", spec="YouTube: 800×800 recommended, circle crop")
    # Safe area 1546×423 centred: x 507–2053, y 508–931
    b.save("youtube", "youtube-banner-2560x1440.png", 2560, 1440,
           b.banner(2560, 1440, text_x=560, text_w=780, node_x=1880, node_r=145, head=80, logo_h=52, text_y=.5, lanes=6, spread=.3),
           use="Channel banner", spec="YouTube: 2560×1440; text/logo inside centred 1546×423 safe area",
           note="All text and the node are inside the 1546×423 all-device safe area.")


def instagram():
    b.avatar("instagram", "instagram-profile-720.png", 720, use="Profile picture", spec="Instagram: displays 110px circle; upload ≥320×320")
    posts = [
        ("01-introducing", "Introducing", "We connect systems.<br><span class='mute'>We engineer intelligence.</span>", "Auvetric Data Solutions is a Windhoek-based technology consultancy. One partner builds and connects the systems; the other makes sure the data they produce can be trusted.", "converge", None, "node", ""),
        ("02-two-disciplines", "Two disciplines · One solution", "Engineering<br><span class='mute'>meets</span> data.", "", "converge", ["Jakes — systems engineering, IoT, ERP integration, infrastructure", "Alex — enterprise data, Power BI, reconciliation, governance", "Together — systems that run, and numbers you can trust"], "lanes", ""),
        ("03-four-practices", "What we do", "Four practices.<br><span class='mute'>One connected capability.</span>", "", "converge", ["Engineering &amp; Development", "Data &amp; Business Intelligence", "Automation &amp; Intelligent Systems", "Technology Consultancy &amp; Integration"], "node", ""),
        ("04-data-principle", "Data &amp; BI principle", "A dashboard is only as trustworthy as the data underneath it.", "Start with where the information comes from, who owns it and how it can go wrong — then report on it.", "data", None, "data", "Alex, Data &amp; BI"),
        ("05-engineering-principle", "Engineering principle", "Design for the conditions the system will actually face.", "Intermittent connectivity, remote sites and shift work are requirements, not edge cases. Make failure visible. Keep the operator in control.", "eng", None, "eng", "Jakes, Systems Engineering"),
        ("06-how-we-work", "How we work", "From complexity<br><span class='mute'>to clarity.</span>", "", "converge", ["Discover", "Investigate", "Architect", "Engineer", "Validate", "Deploy", "Improve"], "lanes", ""),
    ]
    for slug, label, title, body, tone, items, motif, by in posts:
        ts = 1080 * (.074 if len(title) > 60 else .092) if not items else 1080 * .085
        b.save("instagram", f"post-{slug}-1080x1350.png", 1080, 1350,
               b.card(1080, 1350, label=label, title=title, body=body, tone=tone, items=items, motif=motif, quote_by=by, title_size=ts, footer=FOOT, seed=sum(map(ord, slug)) % 97,
                      item_cols=2 if items and len(items) > 5 else 1),
               use="Feed post (also used on LinkedIn and Facebook)", spec="4:5, 1080×1350 — safe within Instagram's 3:4 profile-grid crop",
               note="Copy and alt text in content/05-launch-calendar.md")
    for slug, label, title, body, tone in [
        ("launch", "Now open for projects", "We connect systems.<br><span class='mute'>We engineer intelligence.</span>", "Custom software · Industrial IoT · Power BI · Data quality · Automation", "converge"),
        ("lab", "Interactive demos", "Explore how<br>our solutions work.", "Industrial monitoring and data-integrity simulations — try them on our website.", "converge"),
    ]:
        b.save("instagram", f"story-{slug}-1080x1920.png", 1080, 1920,
               b.card(1080, 1920, label=label, title=title, body=body, tone=tone, motif="node", title_size=118, ui="story"),
               use="Story", spec="9:16, 1080×1920; keep text out of top 250px and bottom 340px UI zones")


def tiktok():
    b.avatar("tiktok", "tiktok-profile-720.png", 720, use="Profile photo", spec="TikTok: square, circle crop; ≥200×200")
    covers = [
        ("why-your-margin-report-is-wrong", "Data &amp; BI · Episode 01", "Why your margin report might be wrong.", "data"),
        ("sensor-to-dashboard", "Engineering · Episode 01", "From sensor to dashboard in 8 steps.", "eng"),
        ("offline-first", "Engineering · Episode 02", "Field apps that don't lose data offline.", "eng"),
        ("duplicate-barcodes", "Data &amp; BI · Episode 02", "One product. Five barcodes. Now what?", "data"),
    ]
    for slug, label, title, tone in covers:
        # TikTok UI: keep text inside x 60–900, y 250–1500 (right-hand action rail, bottom caption)
        b.save("tiktok", f"video-cover-{slug}-1080x1920.png", 1080, 1920,
               b.card(1080, 1920, label=label, title=title, tone=tone, motif=tone, title_size=128, ui="tiktok", seed=len(slug)),
               use="Video cover / first frame", spec="9:16, 1080×1920; text clear of the right action rail and bottom caption zone",
               note="Script in content/05-launch-calendar.md")


def upwork():
    b.avatar("upwork", "upwork-agency-logo-500.png", 500, use="Agency profile photo (logo)", spec="Upwork agency photo = agency logo; ≥250×250, <5 MB")
    b.save("upwork", "upwork-agency-banner-3200x320.png", 3200, 320, b.logo_banner(3200, 320, logo_h=110),
           use="Agency profile banner", spec="Upwork: 3200×320 recommended, little to no text; auto-cropped to screen width",
           note="Logo centred; no text so screen-width cropping never cuts words.")
    for num, name, desc, tone in PRACTICES:
        slug = name.split(" &amp;")[0].lower().replace(" ", "-")
        b.save("upwork", f"project-cover-{num}-{slug}-2000x1500.png", 2000, 1500,
               b.card(2000, 1500, label=f"Practice {num}", title=name, body=desc, tone=tone, motif={"eng": "eng", "data": "data"}.get(tone, "node"), title_size=150, seed=int(num) * 7),
               use="Project Catalog / portfolio cover", spec="Upwork: 4:3, ≤4000px, sharp at 1000×750; no contact details",
               note="No contact information, per Upwork image rules.")


def fiverr():
    b.avatar("fiverr", "fiverr-profile-720.png", 720, use="Seller profile picture (business/team account)", spec="Square, circle crop. Fiverr favours a real photo for individual sellers — see content/04-fiverr.md")
    gigs = [
        ("power-bi-dashboard", "Data &amp; BI", "Power BI dashboards on data you can trust.", "Data modelling · Power Query · KPI design", "data"),
        ("data-cleansing-reconciliation", "Data quality", "Product &amp; supplier data cleansing and reconciliation.", "Excel · Duplicates · Pricing &amp; cost variance", "data"),
        ("iot-telemetry-dashboard", "Industrial IoT", "Node-RED &amp; MQTT telemetry dashboards.", "PLCs · Modbus · Edge buffering · Alarms", "eng"),
        ("erpnext-frappe", "ERP integration", "ERPNext &amp; Frappe customisation and integration.", "Doctypes · Workflows · Print formats · APIs", "eng"),
    ]
    for slug, label, title, body, tone in gigs:
        b.save("fiverr", f"gig-{slug}-1280x769.png", 1280, 769,
               b.card(1280, 769, label=label, title=title, body=body, tone=tone, motif=tone, title_size=76, seed=len(slug) * 3),
               use="Gig image (first gallery image)", spec="Fiverr: 1280×769 recommended (min 712×430); no contact details")


def other():
    b.avatar("github", "github-avatar-500.png", 500, use="GitHub organisation/profile avatar", spec="Square; GitHub crops to circle in places")
    b.save("github", "github-social-preview-1280x640.png", 1280, 640,
           b.banner(1280, 640, text_x=90, text_w=600, node_x=1060, node_r=110, head=56, logo_h=40, text_y=.5),
           use="Repository social preview", spec="GitHub: 1280×640 recommended")
    b.avatar("whatsapp", "whatsapp-business-profile-640.png", 640, use="WhatsApp Business profile photo", spec="Square, circle crop; ≥192×192")
    b.save("email", "email-signature-banner-1200x240.png", 1200, 240,
           b.banner(1200, 240, text_x=60, text_w=440, node_x=1050, node_r=60, head=32, logo_h=30, eyebrow=False, lanes=4, spread=.95),
           use="Email signature banner", spec="Display at 600×120 (2× asset for sharp rendering)")


SECTIONS = {"facebook": facebook, "linkedin": linkedin, "x": x_twitter, "youtube": youtube, "instagram": instagram,
            "tiktok": tiktok, "upwork": upwork, "fiverr": fiverr, "other": other}

if __name__ == "__main__":
    only = sys.argv[1:]
    for key, fn in SECTIONS.items():
        if not only or key in only:
            print(f"[{key}]")
            fn()
    if not only:
        (b.OUT / "MANIFEST.json").write_text(json.dumps(b.MANIFEST, indent=2))
        print(f"{len(b.MANIFEST)} assets written")
