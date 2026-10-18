# Auvetric Data Solutions — Brand Kit v1.0

One system, one source of truth. Every graphic, bio and post here is built from the same colour tokens, fonts, logo files and copy, so all channels look and sound the same.

## Contents

| Folder | What's inside |
|---|---|
| `guide/Auvetric-Brand-Guidelines-v1.0.pdf` | 21-page brand guide: logo, colour, type, graphics, voice, claims policy, asset specs |
| `logos/` | 12 logo variants cut and recoloured from the owner-supplied master (no redrawing). `MANIFEST.json` explains each |
| `social/<platform>/` | 39 ready-to-upload assets at exact platform sizes, see `social/MANIFEST.json` |
| `content/00-06*.md` | Messaging framework, plus copy for LinkedIn, social profiles, Upwork, Fiverr, a 4-week launch calendar and email signatures |
| `fonts/` | Space Grotesk, Inter and JetBrains Mono (SIL Open Font License), self-hosted |
| `tools/` | The generators. Edit source, rebuild, and everything stays consistent |

## Platform coverage

| Platform | Assets | Copy |
|---|---|---|
| Facebook | Profile 720², cover 1702×630 (851×315 @2×) | Intro (≤101), launch posts |
| LinkedIn | Company logo 400², company cover 1512×256, personal banners for Jakes9NA and Alex 1584×396 | Tagline, About, specialties, both partners' headlines and About sections, posts |
| Instagram | Profile, 6 feed posts 1080×1350, 2 stories 1080×1920 | Bio (≤150), captions and alt text |
| TikTok | Profile, 4 video covers 1080×1920 | Bio, captions, 4 full video scripts |
| Upwork | Agency logo, banner 3200×320 (logo only, per Upwork's guidance), 4 Project Catalog covers 2000×1500 | Agency tagline and overview, 3 specialized profiles, 4 catalog listings |
| Fiverr | Profile, 4 gig images 1280×769 | Seller description (≤600), 4 gigs with titles, tags and descriptions |
| X | Profile 400², header 1500×500 | Bio (≤160), posts |
| YouTube | Avatar 800², banner 2560×1440 (content inside 1546×423 safe area) | Channel description |
| GitHub | Avatar, repository social preview 1280×640 | Bio |
| WhatsApp Business | Profile 640² | About |
| Email | Signature banner 1200×240 | HTML signatures for both partners |

## Before you publish

1. Fill the `{PLACEHOLDERS}`: `{EMAIL}`, `{PHONE}`, `{PRICE...}`, `{DELIVERY_DAYS}`, `{REVISIONS}`, `{HOSTED_URL}`.
2. Both partners review `content/05-launch-calendar.md`. Every slot is a draft until approved.
3. Claim the same handle everywhere on the same day (`auvetric` → `auvetricdata` → `auvetric.na`).
4. Fiverr: individual seller accounts should use a real face photo (Fiverr's guidance). Use the Auvetric avatar only on a business or agency account.
5. Confirm the legal entity before setting company type and size on LinkedIn.

## Rebuild

From this folder, with Python 3.10+, Pillow and Google Chrome or Microsoft Edge installed:

```bash
python tools/logos.py          # logo variants from public/brand/auvetric-logo-original.png
python tools/catalogue.py      # all 39 social assets (or: python tools/catalogue.py linkedin)
python tools/build_content.py  # validates every limit and claim, then writes content/*.md
python tools/build_guide.py    # brand guide PDF (needs: pip install pypdf)
python tools/contact_sheet.py  # review sheets in social/_contact-sheet-*.png
```

`build_content.py` refuses to build if any field exceeds its platform character limit, uses banned hype words ("world-class", "seamless", "guarantee" and similar), claims "years of experience", or points at a missing image.

## When auvetric.com goes live

Change `WEBSITE` in `content/source.py`, run `build_content.py` and update the link on each profile. The graphics contain no URL, so they don't need regenerating.

## Verification (this build)

- All 39 social assets were rendered by headless Chrome. The renderer checks each file's pixel size against the platform spec and fails on a mismatch.
- Brand fonts were confirmed rendering (not system fallbacks). Every asset was reviewed on contact sheets; text and motif zones never overlap.
- Copy validated against current platform limits (checked October 2026 against Meta, LinkedIn, Upwork and Fiverr help pages).
- Guide: 21 pages. Every page was rendered and reviewed for overflow and clipping.
- Not done: nothing has been published or uploaded to any platform. Accounts must be created and posts approved by the owners.
