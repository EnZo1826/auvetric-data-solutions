"""Build the Auvetric brand guide (HTML → PDF via headless Chrome). Run from brand-kit/: python tools/build_guide.py"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "content"))
from brand import C, FONTS_CSS, KIT, chrome, convergence, logo  # noqa: E402
import source as S  # noqa: E402

OUT = KIT / "guide"
W, H = 1600, 900  # each page = 16:9 slide; printed to 297 x 167.06 mm


def lum(hx: str) -> float:
    c = [int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return sum(w * (x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x, w in zip(c, [.2126, .7152, .0722]))


def contrast(a: str, b: str) -> float:
    x, y = sorted([lum(a), lum(b)])
    return (y + .05) / (x + .05)


def rgb(hx):
    return tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))


def cmyk(hx):  # naive conversion — printers must confirm against their profile
    r, g, b = [v / 255 for v in rgb(hx)]
    k = 1 - max(r, g, b)
    if k == 1:
        return (0, 0, 0, 100)
    return tuple(round(v * 100) for v in ((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k))


def slide(n: int, title: str, body: str, *, section: str = "", dark: bool = True, bg_motif: str = "") -> str:
    foot = f'<div class="foot"><span>Auvetric Data Solutions · Brand Guide v1.0</span><span>{section}</span><span>{n:02d}</span></div>' if n else ""
    head = f'<div class="ptitle"><div class="mono sec">{section}</div><h2 class="display">{title}</h2></div>' if title else ""
    return f'<section class="page {"" if dark else "light"}">{bg_motif}{head}<div class="pbody">{body}</div>{foot}</section>'


CSS = f"""
@import url('{FONTS_CSS}');
@page {{ size: {W}px {H}px; margin: 0 }}
* {{ box-sizing: border-box; margin: 0; padding: 0 }}
html, body {{ background: {C['void']}; -webkit-print-color-adjust: exact; print-color-adjust: exact }}
body {{ font-family: Inter, sans-serif; color: {C['ink']}; -webkit-font-smoothing: antialiased }}
.display {{ font-family: 'Space Grotesk'; font-weight: 600; letter-spacing: -.03em; line-height: 1.02 }}
.mono {{ font-family: 'JetBrains Mono'; font-weight: 500; text-transform: uppercase; letter-spacing: .14em }}
.page {{ width: {W}px; height: {H}px; position: relative; overflow: hidden; page-break-after: always; break-after: page;
  background: radial-gradient(ellipse 900px 700px at 0% 0%, rgba(0,105,245,.16), transparent 70%), radial-gradient(ellipse 900px 700px at 100% 100%, rgba(0,212,234,.10), transparent 70%), {C['void']} }}
.page.light {{ background: #F5F8FD; color: {C['navyInk']} }}
.ptitle {{ position: absolute; left: 90px; top: 70px; right: 90px }}
.ptitle .sec {{ font-size: 13px; color: {C['cyanInk']}; margin-bottom: 14px }}
.light .ptitle .sec {{ color: {C['blue']} }}
.ptitle h2 {{ font-size: 46px }}
.pbody {{ position: absolute; left: 90px; right: 90px; top: 200px; bottom: 90px }}
.foot {{ position: absolute; left: 90px; right: 90px; bottom: 34px; display: flex; justify-content: space-between; font: 500 11px 'JetBrains Mono'; letter-spacing: .12em; text-transform: uppercase; color: {C['dim']} }}
.light .foot {{ color: #6B7A90 }}
.mute {{ color: {C['mute']} }} .light .mute {{ color: #4A5A72 }}
.cols {{ display: grid; gap: 40px }}
.box {{ border: 1px solid {C['line']}; border-radius: 16px; background: rgba(16,30,52,.6); padding: 26px }}
.light .box {{ border-color: #D6DEEA; background: #fff }}
p {{ font-size: 17px; line-height: 1.6 }}
h3 {{ font-family: 'Space Grotesk'; font-weight: 600; font-size: 22px; letter-spacing: -.01em; margin-bottom: 10px }}
.label {{ font: 500 11px 'JetBrains Mono'; letter-spacing: .14em; text-transform: uppercase; color: {C['dim']}; margin-bottom: 8px }}
ul.clean {{ list-style: none }} ul.clean li {{ padding: 9px 0; border-top: 1px solid {C['line']}; font-size: 16px; line-height: 1.45 }}
.light ul.clean li {{ border-color: #D6DEEA }}
.tick {{ color: {C['ok']} }} .cross {{ color: {C['danger']} }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px }}
td, th {{ text-align: left; padding: 8px 10px; border-top: 1px solid {C['line']} }}
th {{ font: 500 11px 'JetBrains Mono'; letter-spacing: .12em; text-transform: uppercase; color: {C['dim']} }}
"""


XI = f'<svg width="12" height="12" viewBox="0 0 12 12" style="flex:none"><path d="M2 2 10 10M10 2 2 10" stroke="{C["danger"]}" stroke-width="2" stroke-linecap="round"/></svg>'
OK = f'<svg width="14" height="14" viewBox="0 0 14 14" style="flex:none;margin-top:4px"><path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="{C["ok"]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def logo_tile(file: str, bg: str, label: str, h: int = 110, pad: int = 34) -> str:
    return f'<div><div style="background:{bg};border-radius:14px;height:210px;display:flex;align-items:center;justify-content:center;padding:{pad}px;border:1px solid {C["line"]}"><img src="{logo(file)}" style="max-height:{h}px;max-width:100%"></div><div class="label" style="margin-top:12px">{label}</div></div>'


def build() -> Path:
    pages = []
    # 1 Cover
    cov = convergence(W, H, 1150, 450, r=190, lanes=6, spread=.7, seed=5, start_left=760)
    pages.append(f'''<section class="page">{cov}
      <div style="position:absolute;left:110px;top:50%;transform:translateY(-50%);width:640px">
        <img src="{logo('auvetric-horizontal-dark-bg.png')}" style="height:74px;display:block;margin-bottom:60px">
        <div class="mono" style="font-size:15px;color:{C['cyanInk']};margin-bottom:22px">Brand guidelines · Version 1.0</div>
        <div class="display" style="font-size:78px">We connect systems.<br><span style="color:{C['mute']}">We engineer intelligence.</span></div>
      </div>
      <div class="foot"><span>Auvetric Data Solutions · Windhoek, Namibia</span><span>October 2026</span><span>Internal &amp; partner use</span></div></section>''')

    # 2 Contents
    toc = ["The brand", "Two disciplines", "Logo", "Logo variants", "Clear space &amp; sizing", "Logo misuse", "Colour", "Colour in use", "Typography",
           "Graphic language", "Composition rules", "Voice &amp; tone", "Messaging", "Claims policy", "Social applications", "Asset specifications", "Maintaining the system"]
    items = "".join(f'<li style="display:flex;gap:22px"><span class="mono" style="color:{C["cyanInk"]};font-size:13px;width:34px">{i+3:02d}</span>{t}</li>' for i, t in enumerate(toc))
    pages.append(slide(2, "Contents", f'<div class="cols" style="grid-template-columns:1fr 1fr"><ul class="clean">{items[:items.index("<li", len(items)//2)]}</ul><ul class="clean">{items[items.index("<li", len(items)//2):]}</ul></div>', section="Guide"))

    # 3 The brand
    pages.append(slide(3, "The brand", f'''<div class="cols" style="grid-template-columns:1.3fr 1fr">
      <div><p style="font-size:22px;line-height:1.55">{S.MESSAGING['positioning']['text']}</p></div>
      <div class="box"><div class="label">Primary line</div><div class="display" style="font-size:30px;margin-bottom:26px">We connect systems.<br><span class="mute">We engineer intelligence.</span></div>
      <div class="label">Short line</div><div class="mono" style="font-size:15px"><span style="color:{C['blueInk']}">Engineering</span> × <span style="color:{C['cyanInk']}">Data</span> × Intelligence</div>
      <div class="label" style="margin-top:26px">Name</div><p>Always <b>Auvetric Data Solutions</b> in full on first use; <b>Auvetric</b> thereafter. Never "AUVETRIC", "Auvetric DS" or "ADS".</p></div></div>''', section="01 · Identity"))

    # 4 Two disciplines
    pages.append(slide(4, "Two disciplines. One connected solution.", f'''<div class="cols" style="grid-template-columns:1fr 1fr 1fr">
      <div class="box" style="border-color:rgba(0,105,245,.6)"><div class="label" style="color:{C['blueInk']}">Engineering · Electric blue</div><h3>Jakes</h3><p class="mute">Builds and connects the systems: software, ERP integration, industrial IoT, edge devices and infrastructure. Physical and technical subjects take the blue accent.</p></div>
      <div class="box" style="border-color:rgba(0,212,234,.6)"><div class="label" style="color:{C['cyanInk']}">Data · Cyan</div><h3>Alex</h3><p class="mute">Makes the information trustworthy and useful: Power BI, reconciliation, master-data quality and governance. Analytical subjects take the cyan accent.</p></div>
      <div class="box" style="border-image:linear-gradient(90deg,{C['blue']},{C['cyan']}) 1"><div class="label">Together · White node</div><h3>Auvetric</h3><p class="mute">Where both meet, use both colours converging on a white node. This is the brand's central idea and its signature graphic.</p></div></div>
      <p class="mute" style="margin-top:36px;max-width:1100px">Both partners always get equal visual prominence. When one discipline leads a piece of content, it takes that colour; joint content uses the convergence treatment.</p>''', section="01 · Identity"))

    # 5 Logo
    pages.append(slide(5, "The logo", f'''<div class="cols" style="grid-template-columns:1fr 1fr">
      <div style="background:#fff;border-radius:16px;display:flex;align-items:center;justify-content:center;height:520px"><img src="{logo('auvetric-stacked-light-bg.png')}" style="height:400px"></div>
      <div><h3>One mark, used as supplied</h3><p class="mute">The symbol is a folded-ribbon <b>A</b> whose strands become circuit traces ending in three terminals: physical engineering turning into data. The wordmark is <b>Auvetric</b> with <b>DATA SOLUTIONS</b> tracked beneath.</p>
      <p class="mute" style="margin-top:18px">All variants in this kit are cut and recoloured from the owner-supplied master file. Never redraw, retype or re-space the logo. Never rebuild the wordmark in a font.</p>
      <div class="box" style="margin-top:28px"><div class="label">Master file</div><p style="font-family:JetBrains Mono;font-size:13px">public/brand/auvetric-logo-original.png</p><div class="label" style="margin-top:14px">Variants</div><p style="font-family:JetBrains Mono;font-size:13px">brand-kit/logos/ (12 files, see MANIFEST.json)</p></div></div></div>''', section="02 · Logo"))

    # 6 Variants
    v = [("auvetric-horizontal-dark-bg.png", C["void"], "Horizontal · dark backgrounds (primary)"),
         ("auvetric-horizontal-light-bg.png", "#FFFFFF", "Horizontal · light backgrounds"),
         ("auvetric-stacked-dark-bg.png", C["void"], "Stacked · dark"),
         ("auvetric-horizontal-mono-white.png", "#2B4A72", "Mono white · photos &amp; single colour"),
         ("auvetric-horizontal-mono-navy.png", "#E9EEF6", "Mono navy · single colour on light"),
         ("auvetric-avatar-dark-1024.png", C["base"], "Symbol avatar · all profiles")]
    tiles = "".join(logo_tile(f, bg, l, h=150 if "stacked" in f or "avatar" in f else 84) for f, bg, l in v)
    pages.append(slide(6, "Logo variants", f'<div class="cols" style="grid-template-columns:repeat(3,1fr);gap:28px">{tiles}</div>', section="02 · Logo"))

    # 7 Clear space
    pages.append(slide(7, "Clear space &amp; minimum size", f'''<div class="cols" style="grid-template-columns:1.2fr 1fr">
      <div style="position:relative;background:{C['base']};border-radius:16px;height:500px;display:flex;align-items:center;justify-content:center;border:1px solid {C['line']}">
        <div style="position:relative;padding:62px;outline:2px dashed {C['cyan']};outline-offset:-2px">
          <img src="{logo('auvetric-horizontal-dark-bg.png')}" style="height:124px;display:block;outline:1px solid rgba(243,247,255,.25)">
          <div class="mono" style="position:absolute;top:18px;left:50%;transform:translateX(-50%);font-size:12px;color:{C['cyanInk']}">X</div>
          <div class="mono" style="position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font-size:12px;color:{C['cyanInk']}">X</div>
          <div class="mono" style="position:absolute;left:22px;top:50%;transform:translateY(-50%);font-size:12px;color:{C['cyanInk']}">X</div>
          <div class="mono" style="position:absolute;right:22px;top:50%;transform:translateY(-50%);font-size:12px;color:{C['cyanInk']}">X</div></div></div>
      <div><h3>Clear space = X</h3><p class="mute">X is half the height of the logo symbol. Keep at least X clear on every side: no text, edges or other graphics inside it.</p>
      <h3 style="margin-top:34px">Minimum sizes</h3><table><tr><th>Asset</th><th>Digital</th><th>Print</th></tr>
      <tr><td>Horizontal lockup</td><td>140 px wide</td><td>35 mm wide</td></tr><tr><td>Stacked logo</td><td>90 px wide</td><td>22 mm wide</td></tr>
      <tr><td>Symbol only</td><td>24 px wide</td><td>8 mm wide</td></tr></table>
      <p class="mute" style="margin-top:22px">Below the stacked minimum, use the horizontal lockup. Below the horizontal minimum, use the symbol on its own.</p></div></div>''', section="02 · Logo"))

    # 8 Misuse
    base = logo("auvetric-horizontal-dark-bg.png")
    bad = [("transform:scaleX(1.45)", "Don't stretch or squash"), ("transform:rotate(-12deg)", "Don't rotate"),
           ("filter:hue-rotate(140deg)", "Don't recolour"), ("filter:drop-shadow(8px 8px 0 #F16B77)", "Don't add effects"),
           ("opacity:.35", "Don't fade or lower contrast"), ("", "Don't place on busy backgrounds")]
    cells = ""
    for css, lab in bad:
        bgcss = f"background:repeating-linear-gradient(45deg,#2B6CC4 0 18px,#F0B35A 18px 36px)" if "busy" in lab else f"background:{C['base']}"
        cells += f'<div><div style="{bgcss};border-radius:14px;height:180px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid {C["line"]};position:relative"><img src="{base}" style="height:58px;{css}"><svg style="position:absolute;inset:0" width="100%" height="100%"><line x1="0" y1="100%" x2="100%" y2="0" stroke="{C["danger"]}" stroke-width="3" stroke-opacity=".85"/></svg></div><div class="label" style="margin-top:12px;color:{C["danger"]};display:flex;align-items:center;gap:8px">{XI}{lab}</div></div>'
    pages.append(slide(8, "Logo misuse", f'<div class="cols" style="grid-template-columns:repeat(3,1fr);gap:28px">{cells}</div><p class="mute" style="margin-top:26px">Also never: outline the logo, change the type, separate the wordmark from DATA SOLUTIONS, or put the light-background version on a dark ground.</p>', section="02 · Logo"))

    # 9 Colour
    core = [("Electric Blue", "blue", "Engineering · primary actions"), ("Signal Cyan", "cyan", "Data · highlights"), ("Void Navy", "void", "Primary background"),
            ("Base Navy", "base", "Secondary background"), ("Panel Navy", "panel", "Cards &amp; panels"), ("Ink White", "ink", "Primary text")]
    sw = ""
    for name, k, use in core:
        hx = C[k]
        sw += f'''<div class="box" style="padding:0;overflow:hidden"><div style="height:170px;background:{hx};border-bottom:1px solid {C['line']}"></div><div style="padding:18px">
          <h3 style="font-size:19px;margin-bottom:4px">{name}</h3><div class="label">{use}</div>
          <div style="font:500 13px JetBrains Mono;line-height:1.7;margin-top:8px">HEX {hx}<br>RGB {', '.join(map(str, rgb(hx)))}<br>CMYK {' '.join(map(str, cmyk(hx)))}*</div></div></div>'''
    pages.append(slide(9, "Colour palette", f'<div class="cols" style="grid-template-columns:repeat(6,1fr);gap:18px">{sw}</div><p class="mute" style="margin-top:20px;font-size:14px">*CMYK values are direct conversions for reference only. Ask the printer to match the HEX values using their own colour profile, and approve a proof before a full print run.</p>', section="03 · Colour"))

    # 10 Colour in use
    support = [("Light Blue (text)", "blueInk"), ("Light Cyan (text)", "cyanInk"), ("Muted text", "mute"), ("Success", "ok"), ("Warning", "warn"), ("Error / alarm", "danger")]
    sup = "".join(f'<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-top:1px solid {C["line"]}"><span style="width:38px;height:38px;border-radius:9px;background:{C[k]}"></span><span style="flex:1">{n}</span><span style="font:500 13px JetBrains Mono">{C[k]}</span><span style="font:500 13px JetBrains Mono;width:150px;text-align:right;white-space:nowrap">{contrast(C[k], C["panel"]):.1f}:1 on panel</span></div>' for n, k in support)
    ratio = [("Void Navy", 60, C["void"]), ("Panels", 20, C["panel"]), ("Ink text", 10, C["ink"]), ("Electric Blue", 5, C["blue"]), ("Signal Cyan", 5, C["cyan"])]
    bar = "".join(f'<div style="flex:{p};background:{c}"></div>' for n, p, c in ratio)
    legend = "".join(f'<span style="display:inline-flex;align-items:center;gap:8px;margin:12px 18px 0 0;font:500 12px JetBrains Mono;color:{C["mute"]}"><i style="width:12px;height:12px;border-radius:3px;background:{c};border:1px solid {C["line2"]}"></i>{n} {p}%</span>' for n, p, c in ratio)
    pages.append(slide(10, "Colour in use", f'''<div class="cols" style="grid-template-columns:1fr 1fr">
      <div><h3>Proportion</h3><div style="display:flex;height:90px;border-radius:12px;overflow:hidden;border:1px solid {C['line']}">{bar}</div><div>{legend}</div>
      <p class="mute" style="margin-top:22px">The brand is dark and calm. Navy carries most of every layout; blue and cyan are signals, not floods. Never fill large areas with saturated blue or cyan behind text.</p>
      <h3 style="margin-top:30px">Text contrast</h3><p class="mute">Body text on navy uses Ink White ({contrast(C['ink'], C['void']):.1f}:1) or Muted ({contrast(C['mute'], C['void']):.1f}:1). Coloured text uses the light text tints, never the pure fills. White on Electric Blue buttons is {contrast('#FFFFFF', C['blue']):.2f}:1, which passes WCAG AA for normal text.</p></div>
      <div><h3>Support &amp; status colours</h3>{sup}<p class="mute" style="margin-top:16px;font-size:14px">Status colours are for meaning only: green means verified or passing, amber means warning or needs review, pink-red means error or alarm. Never use pink-red decoratively.</p></div></div>''', section="03 · Colour"))

    # 11 Typography
    pages.append(slide(11, "Typography", f'''<div class="cols" style="grid-template-columns:1.2fr 1fr 1fr;gap:30px">
      <div class="box"><div class="label">Display · Space Grotesk 600</div><div class="display" style="font-size:64px">Aa Bb 0123</div><p class="mute" style="margin-top:14px">Headlines, statements, numbers. Tight tracking (−0.03 em), line height 1.0–1.1. Sentence case.</p></div>
      <div class="box"><div class="label">Body · Inter 400 / 500 / 600</div><div style="font-size:44px;font-weight:500">Aa Bb 0123</div><p class="mute" style="margin-top:14px">Paragraphs, UI and documents. 16–20 px on screen, line height 1.5–1.6.</p></div>
      <div class="box"><div class="label">Technical · JetBrains Mono 500</div><div style="font:500 36px 'JetBrains Mono'">Aa 0123</div><p class="mute" style="margin-top:14px">Labels, data, code and measurements only. Uppercase with wide tracking for labels.</p></div></div>
      <div class="box" style="margin-top:28px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;align-items:end">
      <div><div class="label">H1 · 56–80</div><div class="display" style="font-size:56px">Systems</div></div><div><div class="label">H2 · 36–48</div><div class="display" style="font-size:40px">Data quality</div></div>
      <div><div class="label">Body · 17</div><p>Reliable data and connected technology.</p></div><div><div class="label">Label · 12</div><div class="mono" style="font-size:12px;color:{C['cyanInk']}">Engineering × Data</div></div></div>
      <p class="mute" style="margin-top:18px;font-size:14px">All three fonts are free (SIL Open Font License). Font files are in brand-kit/fonts/. In Microsoft Office, if the brand fonts aren't installed, fall back to Segoe UI for display and body, and Consolas for technical labels.</p>''', section="04 · Type"))

    # 12 Graphic language
    demo = convergence(620, 340, 400, 170, r=80, lanes=5, spread=.7, seed=9, start_left=40, start_right=620)
    pages.append(slide(12, "Graphic language", f'''<div class="cols" style="grid-template-columns:1.25fr 1fr">
      <div class="box" style="padding:0;position:relative;height:380px;overflow:hidden"><div style="position:absolute;inset:0">{demo.replace('class="layer"','style="position:absolute;inset:0"')}</div><div class="label" style="position:absolute;left:20px;bottom:10px">The convergence node</div></div>
      <div><ul class="clean">
      <li><b>Convergence node.</b> <span class="mute">Blue engineering paths from the left and cyan data paths from the right meet at a white node with crossed orbits and a tick ring. The brand's signature, used on every banner.</span></li>
      <li><b>Circuit terminals.</b> <span class="mute">Paths begin at ring terminals, taken from the three circuit ends in the logo.</span></li>
      <li><b>Engineering grid.</b> <span class="mute">A faint 7% grid, faded at the edges with a radial mask.</span></li>
      <li><b>Glows.</b> <span class="mute">Soft blue glow upper left, cyan lower right. Atmosphere, never a halo around text.</span></li>
      <li><b>Data packets.</b> <span class="mute">Small dots on paths. Static in print, animated on the website.</span></li></ul></div></div>
      <p class="mute" style="margin-top:22px">No stock photography of handshakes, glowing brains or generic servers. When photography is needed, use real work: equipment, sites, dashboards on screen and the partners themselves.</p>''', section="05 · Graphics"))

    # 13 Composition
    pages.append(slide(13, "Composition rules", f'''<div class="cols" style="grid-template-columns:repeat(3,1fr)">
      <div class="box"><h3>1 · Text and motif never overlap</h3><p class="mute">On wide formats the convergence node takes the right side. On portrait formats it takes a band at the bottom. Text keeps its own zone.</p></div>
      <div class="box"><h3>2 · Respect platform overlays</h3><p class="mute">Profile pictures cover the lower left of covers. Stories and TikTok cover the top 260 px and bottom 340 px. Keep text clear of these zones.</p></div>
      <div class="box"><h3>3 · One message per graphic</h3><p class="mute">A mono label, a headline in Space Grotesk, and at most a line or list beneath. If it needs a paragraph, it belongs in the caption.</p></div>
      <div class="box"><h3>4 · Left-aligned, generous space</h3><p class="mute">Text aligns left on an 8% margin. Space above a heading is always larger than below it.</p></div>
      <div class="box"><h3>5 · Second line in Muted</h3><p class="mute">Two-part headlines set the first line in Ink White and the second in Muted, as in "We connect systems. / We engineer intelligence."</p></div>
      <div class="box"><h3>6 · Label demos honestly</h3><p class="mute">Anything simulated says "synthetic" or "demo". Concepts are labelled as concepts.</p></div></div>''', section="05 · Graphics"))

    # 14 Voice
    vt = "".join(f'<li><b>{a}.</b> <span class="mute">{b}</span></li>' for a, b in S.VOICE)
    pages.append(slide(14, "Voice &amp; tone", f'''<div class="cols" style="grid-template-columns:1.3fr 1fr"><ul class="clean">{vt}</ul>
      <div><div class="box" style="margin-bottom:20px"><div class="label tick">Write like this</div><p>"We capture every fuel dispense at the pump, even when the site is offline, and reconcile it against the ERP every night."</p></div>
      <div class="box"><div class="label cross">Not like this</div><p class="mute">"Our cutting-edge, AI-powered platform delivers seamless, world-class fuel intelligence!"</p></div>
      <p class="mute" style="margin-top:20px;font-size:15px">Words to avoid: revolutionary, cutting-edge, world-class, seamless, best-in-class, guarantee, synergy, leverage (as a verb), unlock.</p></div></div>''', section="06 · Voice"))

    # 15 Messaging
    pages.append(slide(15, "Messaging", f'''<div class="cols" style="grid-template-columns:1fr 1fr">
      <div><div class="label">25 words</div><p style="margin-bottom:24px">{S.MESSAGING['boilerplate_25']['text']}</p><div class="label">50 words</div><p>{S.MESSAGING['boilerplate_50']['text']}</p></div>
      <div><div class="label">Elevator pitch (spoken)</div><p style="font-size:19px;margin-bottom:26px">{S.MESSAGING['elevator_pitch']['text']}</p>
      <div class="label">Four practices</div><ul class="clean"><li>01 Engineering &amp; Development</li><li>02 Data &amp; Business Intelligence</li><li>03 Automation &amp; Intelligent Systems</li><li>04 Technology Consultancy &amp; Integration</li></ul></div></div>
      <p class="mute" style="margin-top:20px;font-size:14px">Full copy for every platform: brand-kit/content/. Source of truth: content/source.py.</p>''', section="06 · Voice"))

    # 16 Claims
    al = "".join(f'<li style="display:flex;gap:12px">{OK}<span>{c}</span></li>' for c in S.CLAIMS["allowed"])
    nv = "".join(f'<li style="display:flex;gap:12px">{XI.replace("flex:none","flex:none;margin-top:5px")}<span>{c}</span></li>' for c in S.CLAIMS["never"])
    pages.append(slide(16, "Claims policy", f'<div class="cols" style="grid-template-columns:1fr 1fr"><div><h3>We may say</h3><ul class="clean">{al}</ul></div><div><h3>We never publish</h3><ul class="clean">{nv}</ul></div></div><p class="mute" style="margin-top:22px">Credibility is the brand. A specific, honest description of how we work beats any unverifiable claim. Both partners approve anything that mentions the other partner\'s work.</p>', section="06 · Voice"))

    # 17-18 Social applications (thumbnails)
    man = json.loads((KIT / "social/MANIFEST.json").read_text())
    pick = ["social/facebook/facebook-cover-1702x630.png", "social/linkedin/linkedin-company-cover-1512x256.png", "social/x/x-header-1500x500.png", "social/upwork/upwork-agency-banner-3200x320.png", "social/linkedin/linkedin-personal-banner-alex-1584x396.png"]
    thumbs = "".join(f'<div><img src="{(KIT / p).as_uri()}" style="width:100%;border-radius:8px;border:1px solid {C["line"]};display:block"><div class="label" style="margin-top:8px">{p.split("/")[-1]}</div></div>' for p in pick)
    pages.append(slide(17, "Social applications · covers", f'<div class="cols" style="grid-template-columns:1fr 1fr;gap:22px 30px">{thumbs}</div>', section="07 · Applications"))
    port = ["social/instagram/post-01-introducing-1080x1350.png", "social/instagram/post-02-two-disciplines-1080x1350.png", "social/instagram/post-04-data-principle-1080x1350.png", "social/tiktok/video-cover-sensor-to-dashboard-1080x1920.png", "social/fiverr/gig-power-bi-dashboard-1280x769.png"]
    port = port[:4]
    th2 = "".join(f'<div><img src="{(KIT / p).as_uri()}" style="height:480px;border-radius:8px;border:1px solid {C["line"]};display:block"><div class="label" style="margin-top:8px">{p.split("/")[1]} · {p.split("-")[-1][:-4]}</div></div>' for p in port)
    pages.append(slide(18, "Social applications · posts &amp; covers", f'<div style="display:flex;gap:28px;align-items:flex-end;justify-content:space-between">{th2}</div>', section="07 · Applications"))

    # 19 Specs table
    seen, uniq = set(), []
    for m in man:
        key = (m["platform"], m["size"], m["use"])
        if key not in seen and not m["file"].split("/")[-1].startswith(("post-0", "video-cover", "gig-", "project-cover", "story-")):
            seen.add(key); uniq.append(m)
    groups = [("Instagram feed posts (6)", "1080x1350", "4:5; safe in 3:4 grid crop"), ("Instagram stories (2)", "1080x1920", "9:16; text clear of top 260 / bottom 340 px"),
              ("TikTok video covers (4)", "1080x1920", "9:16; clear of right rail &amp; caption"), ("Upwork project covers (4)", "2000x1500", "4:3; no contact details"), ("Fiverr gig images (4)", "1280x769", "Fiverr recommended size")]
    rws = [f'<tr><td>{m["platform"]}</td><td>{m["use"]}</td><td style="font-family:JetBrains Mono;font-size:11px;white-space:nowrap">{m["size"]}</td></tr>' for m in uniq]
    rws += [f'<tr><td colspan="2">{g}</td><td style="font-family:JetBrains Mono;font-size:11px">{s}</td></tr>' for g, s, _ in groups]
    half = (len(rws) + 1) // 2
    tbl = lambda rs: f'<table style="font-size:12.5px"><tr><th>Platform</th><th>Asset</th><th>Pixels</th></tr>{"".join(rs)}</table>'
    pages.append(slide(19, "Asset specifications", f'<div class="cols" style="grid-template-columns:1fr 1fr;gap:40px">{tbl(rws[:half])}{tbl(rws[half:])}</div><p class="mute" style="margin-top:14px;font-size:13px">All {len(man)} files with platform rules and placement notes: social/MANIFEST.json. Specs were checked against platform help pages in October 2026. Platforms change them, so re-check before major updates.</p>', section="07 · Applications"))

    # 20 Maintaining
    pages.append(slide(20, "Maintaining the system", f'''<div class="cols" style="grid-template-columns:repeat(3,1fr)">
      <div class="box"><h3>Edit copy</h3><p class="mute">Change text in content/source.py or content/launch_calendar.py, then run<br><code style="font-family:JetBrains Mono;color:{C['cyanInk']}">python tools/build_content.py</code><br>It refuses to build if a field exceeds its platform limit or uses banned claims.</p></div>
      <div class="box"><h3>Rebuild graphics</h3><p class="mute">All banners and posts are generated from tools/catalogue.py with the brand tokens:<br><code style="font-family:JetBrains Mono;color:{C['cyanInk']}">python tools/catalogue.py</code><br>Every file is rendered at its exact platform size.</p></div>
      <div class="box"><h3>When auvetric.com goes live</h3><p class="mute">Change WEBSITE in content/source.py, rebuild the content, then update the link on every profile. The graphics contain no URL, so they don't need to change.</p></div></div>
      <div class="box" style="margin-top:28px"><h3>Before publishing</h3><p class="mute">Fill the {{PLACEHOLDERS}}: email, phone, prices and delivery times. Both partners approve the launch calendar. Claim the same handle on every platform on the same day.</p></div>''', section="08 · System"))

    # Back cover
    pages.append(f'''<section class="page">{convergence(W, H, 800, 470, r=150, lanes=6, spread=.62, seed=12)}
      <div style="position:absolute;left:0;right:0;top:140px;text-align:center"><img src="{logo('auvetric-horizontal-dark-bg.png')}" style="height:64px"></div>
      <div style="position:absolute;left:0;right:0;bottom:120px;text-align:center"><div class="display" style="font-size:40px">We connect systems. <span style="color:{C['mute']}">We engineer intelligence.</span></div>
      <div class="mono" style="font-size:13px;color:{C['dim']};margin-top:22px">Windhoek, Namibia · {S.FUTURE_DOMAIN} (coming soon)</div></div></section>''')

    html = f'<!doctype html><html><head><meta charset="utf-8"><title>Auvetric Data Solutions — Brand Guidelines</title><style>{CSS}</style></head><body>{"".join(pages)}</body></html>'
    OUT.mkdir(exist_ok=True)
    src = OUT / "auvetric-brand-guide.html"
    src.write_text(html, encoding="utf-8")
    pdf = OUT / "Auvetric-Brand-Guidelines-v1.0.pdf"
    with tempfile.TemporaryDirectory(dir=KIT / "tools") as td:
        subprocess.run([str(chrome()), "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=6000",
                        f"--user-data-dir={Path(td) / 'p'}", f"--print-to-pdf={pdf}", src.as_uri()], check=True, capture_output=True, timeout=180)
    return pdf


if __name__ == "__main__":
    p = build()
    from pypdf import PdfReader, PdfWriter
    r = PdfReader(str(p))
    w = PdfWriter(clone_from=r)
    w.add_metadata({"/Title": "Auvetric Data Solutions — Brand Guidelines v1.0", "/Author": "Auvetric Data Solutions", "/Subject": "Brand identity, voice and asset standards"})
    with open(p, "wb") as fh:
        w.write(fh)
    print(p, len(r.pages), "pages")
