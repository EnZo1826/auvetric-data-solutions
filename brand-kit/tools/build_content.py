"""Validate the copy in content/source.py + content/launch_calendar.py and write the markdown handbooks.

Fails (exit 1) if: any field exceeds its platform limit, banned hype/claim language appears, a
referenced asset is missing, or Fiverr tag rules are broken. Run from brand-kit/: python tools/build_content.py
"""
import re
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT / "content"))
import source as S  # noqa: E402
import launch_calendar as Cal  # noqa: E402

OUT = KIT / "content"
errors: list[str] = []
BANNED = [r"\bguarantee", r"world[- ]class", r"cutting[- ]edge", r"\bseamless", r"revolutionar", r"\bbest[- ]in[- ]class",
          r"\b#1\b", r"\b100%", r"\bcertified\b", r"\bleading provider", r"\btrusted by\b", r"\bawarded\b", r"!"]
POST_LIMITS = {"linkedin": 3000, "instagram": 2200, "facebook": 63206, "x": 280, "tiktok": 2200, "instagram_reel": 2200, "linkedin_video": 3000}
CLIENT_SAFE = ("Message us", "message us")


def check(name: str, text: str, limit):
    n = len(text)
    if limit and n > limit:
        errors.append(f"{name}: {n} chars > limit {limit}")
    for pat in BANNED:
        if re.search(pat, text, re.I):
            errors.append(f"{name}: banned pattern {pat!r}")
    if re.search(r"\byears? of experience\b", text, re.I):
        errors.append(f"{name}: 'years of experience' claim (use the approved wording)")
    return n


def field(name, f):
    n = check(name, f["text"], f["limit"])
    lim = f"{n}/{f['limit']}" if f["limit"] else f"{n} chars"
    return f"**{name}** · `{lim}` · _{f['src']}_\n\n```text\n{f['text']}\n```\n"


def asset(path):
    if not (KIT / path).exists():
        errors.append(f"missing asset {path}")
    return f"`{path}`"


def write(fn, title, body):
    (OUT / fn).write_text(f"# {title}\n\n{body}".rstrip() + "\n", encoding="utf-8")


# 00 Messaging
m = ["Single source: `content/source.py`. Placeholders in `{BRACES}` need owner input.\n",
     "## Positioning\n", field("Positioning statement", S.MESSAGING["positioning"]),
     "## Taglines\n", field("Primary tagline", S.MESSAGING["tagline_primary"]), field("Short line / eyebrow", S.MESSAGING["tagline_short"]),
     "## Boilerplates\n", field("25-word", S.MESSAGING["boilerplate_25"]), field("50-word", S.MESSAGING["boilerplate_50"]), field("100-word", S.MESSAGING["boilerplate_100"]),
     "## Elevator pitch\n", field("Spoken (about 30s)", S.MESSAGING["elevator_pitch"]),
     "## Voice principles\n", "\n".join(f"- **{a}.** {b}" for a, b in S.VOICE), "\n\n## Claims policy\n",
     "**Allowed (verified):**\n", "\n".join(f"- {c}" for c in S.CLAIMS["allowed"]), "\n\n**Never publish:**\n", "\n".join(f"- {c}" for c in S.CLAIMS["never"]),
     "\n\n## Hashtag sets\n", "\n".join(f"- **{k}:** {' '.join(v)}" for k, v in S.HASHTAGS.items()),
     "\n\nUse 3–5 hashtags on LinkedIn, 5–10 on Instagram and TikTok, 0–2 on X and Facebook."]
for k, f in S.MESSAGING.items():
    check(k, f["text"], f["limit"])
write("00-messaging-framework.md", "Messaging framework", "\n".join(m))

# 01 LinkedIn
L = S.LINKEDIN
li = ["## Company Page\n", field("Name", L["company_name"]), field("Tagline", L["company_tagline"]), field("About", L["company_about"]), field("Specialties", L["company_specialties"]),
      "Assets: logo " + asset("social/linkedin/linkedin-company-logo-400.png") + ", cover " + asset("social/linkedin/linkedin-company-cover-1512x256.png") + ".\n",
      "Settings: Industry **IT Services and IT Consulting** · Company size **2–10** · Type **Partnership** (confirm legal form) · Location **Windhoek, Namibia** · Website: live URL until auvetric.com is connected.\n",
      "## Jakes, personal profile\n", field("Headline", L["jakes_headline"]), field("About", L["jakes_about"]), "Banner: " + asset("social/linkedin/linkedin-personal-banner-jakes-1584x396.png") + "\n",
      "## Alex, personal profile\n", field("Headline", L["alex_headline"]), field("About", L["alex_about"]), "Banner: " + asset("social/linkedin/linkedin-personal-banner-alex-1584x396.png") + "\n",
      "Both partners: set current position **Co-founder, Auvetric Data Solutions** and link it to the Company Page so the logo appears on your profile."]
write("01-linkedin.md", "LinkedIn", "\n".join(li))

# 02 Other social bios
B = S.BIOS
so = ["Use the same avatar (the Auvetric symbol on brand navy) everywhere so the brand is recognisable at 36px.\n",
      "## Facebook Page\n", field("Intro", B["facebook_intro"]), "Category: **IT Services & Consulting**. Button: **Contact us** → website. Assets: " + asset("social/facebook/facebook-profile-720.png") + ", " + asset("social/facebook/facebook-cover-1702x630.png") + "\n",
      "## Instagram\n", field("Bio", B["instagram_bio"]), "Name field: `Auvetric Data Solutions` (searchable). Assets: " + asset("social/instagram/instagram-profile-720.png") + "; launch posts in the calendar.\n",
      "## TikTok\n", field("Bio", B["tiktok_bio"]), "Assets: " + asset("social/tiktok/tiktok-profile-720.png") + "; video covers in the calendar.\n",
      "## X\n", field("Bio", B["x_bio"]), "Assets: " + asset("social/x/x-profile-400.png") + ", " + asset("social/x/x-header-1500x500.png") + "\n",
      "## YouTube\n", field("Channel description", B["youtube_description"]), "Assets: " + asset("social/youtube/youtube-avatar-800.png") + ", " + asset("social/youtube/youtube-banner-2560x1440.png") + "\n",
      "## GitHub\n", field("Bio", B["github_bio"]), "Assets: " + asset("social/github/github-avatar-500.png") + ", repository social preview " + asset("social/github/github-social-preview-1280x640.png") + "\n",
      "## WhatsApp Business\n", field("About", B["whatsapp_about"]), "Asset: " + asset("social/whatsapp/whatsapp-business-profile-640.png") + "\n",
      "## Handles\n", "Use the same handle everywhere if available, in this order of preference: `auvetric` → `auvetricdata` → `auvetric.na`. Claim them all on the same day, even platforms you won't use yet."]
write("02-social-profiles.md", "Social profiles", "\n".join(so))

# 03 Upwork
U = S.UPWORK
up = ["Agency profiles need at least one agency service, a location and a member roster. Each partner keeps a personal freelancer profile and joins the agency.\n",
      "## Agency profile\n", field("Agency name", U["agency_name"]), field("Tagline", U["agency_tagline"]), field("Overview", U["agency_overview"]),
      "Assets: logo " + asset("social/upwork/upwork-agency-logo-500.png") + ", banner " + asset("social/upwork/upwork-agency-banner-3200x320.png") + " (logo only: Upwork asks for little to no text).\n",
      "Agency services to select: Data Analysis & Testing · Data Visualization · IoT & Embedded · Web Development · ERP/CRM Software · Business Intelligence · Data Processing · Automation. Location: Windhoek, Namibia.\n",
      "## Specialized profiles (each partner's freelancer profile)\n"]
for i, sp in enumerate(U["specialized_profiles"], 1):
    up += [f"### Specialized profile {i}\n", field("Title", sp["title"]), field("Overview", sp["overview"])]
up += ["## Project Catalog\n", "Prices are deliberately left blank. Agree them between the partners before publishing (`{PRICE_STARTER}` / `{PRICE_STANDARD}` / `{PRICE_ADVANCED}`). Upwork images may not contain contact details; the covers comply.\n"]
for i, p in enumerate(U["project_catalog"], 1):
    up += [f"### Project {i}\n", field("Title", p["title"]), field("Summary", p["summary"]), "Tiers:\n" + "\n".join(f"- {t} · `{{PRICE}}` · `{{DELIVERY_DAYS}}` days" for t in p["tiers"]) + "\n", "Cover: " + asset(p["cover"]) + "\n"]
write("03-upwork.md", "Upwork", "\n".join(up))

# 04 Fiverr
Fv = S.FIVERR
fv = ["Fiverr expects individual sellers to use a clear face photo. For a two-person brand: each partner sells on their own account with their own photo and uses the Auvetric gig images and wording below, or apply for a Fiverr business/agency seller account and use the Auvetric avatar.\n",
      "## Seller profile\n", field("Description", Fv["seller_description"]), "Avatar (agency account only): " + asset("social/fiverr/fiverr-profile-720.png") + "\n", "## Gigs\n",
      "Gig titles begin with Fiverr's pre-filled 'I will'. Keep the visible part under about 50 characters where possible so the card doesn't truncate it. Up to 5 tags per gig. Packages and prices stay blank until agreed.\n"]
for i, g in enumerate(Fv["gigs"], 1):
    if len(g["tags"]) > 5:
        errors.append(f"gig {i}: more than 5 tags")
    for t in g["tags"]:
        if len(t) > 20:
            errors.append(f"gig {i}: tag '{t}' > 20 chars")
    fv += [f"### Gig {i}\n", field("Title", g["title"]), "Tags: " + ", ".join(f"`{t}`" for t in g["tags"]) + "\n", field("Description", g["description"]),
           "Packages: Basic / Standard / Premium · `{PRICE}` · `{DELIVERY_DAYS}` · `{REVISIONS}`\n", "Gig image: " + asset(g["image"]) + "\n"]
write("04-fiverr.md", "Fiverr", "\n".join(fv))

# 05 Calendar
c = ["Every slot below is **draft: needs owner approval**. Nothing has been published. Posting times (Africa/Windhoek, UTC+2): LinkedIn Tue–Thu 08:00–10:00; Instagram and Facebook 12:00–13:00 or 18:00–20:00; TikTok 19:00–21:00.\n",
     "## Objectives\n", "\n".join(f"- **{k}**: {v}" for k, v in Cal.OBJECTIVES.items()), "\n"]
for p in Cal.POSTS:
    c.append(f"## Week {p['week']} · {p['day']} · {p['objective']}\n")
    c.append(f"Asset: {asset(p['asset'])}\n\nAlt text ({len(p['alt'])} chars): {p['alt']}\n")
    check(f"alt w{p['week']}{p['day']}", p["alt"], 1000)
    for plat, txt in p["copy"].items():
        n = check(f"post w{p['week']}{p['day']} {plat}", txt, POST_LIMITS.get(plat))
        lim = POST_LIMITS.get(plat)
        c.append(f"**{plat}** · `{n}{'/' + str(lim) if lim else ' chars'}`\n\n```text\n{txt}\n```\n")
    if p.get("script"):
        c.append(f"Script: see **{p['script']}** below.\n")
c.append("## Video scripts\n")
for k, s in Cal.SCRIPTS.items():
    c.append(f"### {k} · {s['length']}\n\nRecording: {s['screen']}\n\n" + "\n".join(f"{i}. {b}" for i, b in enumerate(s["beats"], 1)) + "\n")
    for b in s["beats"]:
        check(f"script {k}", b, None)
write("05-launch-calendar.md", "Four-week launch calendar", "\n".join(c))

# 06 Email signature
html = []
for who, lines in S.EMAIL_SIGNATURE.items():
    html.append(f"""<!-- {who} -->
<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#061433;font-size:13px;line-height:1.45">
  <tr><td style="padding-bottom:8px"><strong style="font-size:15px">{lines[0]}</strong><br><span style="color:#0069F5">{lines[1]}</span></td></tr>
  <tr><td style="padding-bottom:8px">{lines[2]}<br>{lines[3]}<br><a href="{lines[4]}" style="color:#0069F5;text-decoration:none">{lines[4]}</a></td></tr>
  <tr><td><img src="{{HOSTED_URL}}/auvetric-horizontal-light-bg.png" alt="Auvetric Data Solutions" width="180" style="display:block;border:0"></td></tr>
</table>""")
write("06-email-signature.md", "Email signatures",
      "Host the logo at a public URL (for example the website's `/brand/` folder) and replace `{HOSTED_URL}`. Use the light-background logo because most mail clients render white. The optional banner is `social/email/email-signature-banner-1200x240.png` (display at 600×120).\n\n```html\n" + "\n\n".join(html) + "\n```")

if errors:
    print("CONTENT CHECK FAILED:")
    print("\n".join(f"  - {e}" for e in errors))
    sys.exit(1)
print("Content check passed: all fields within platform limits, no banned claims, all assets present.")
for f in sorted(OUT.glob("0*.md")):
    print(" ", f.name, f.stat().st_size, "bytes")
