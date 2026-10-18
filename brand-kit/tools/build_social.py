"""Composition library for social / marketplace assets. The asset list and entry point live in catalogue.py."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from brand import C, KIT, background, convergence, logo, page, render, trace  # noqa: E402

OUT = KIT / "social"
TAGLINE_1, TAGLINE_2 = "We connect systems.", "We engineer intelligence."
EYEBROW = '<span class="blue">Engineering</span> × <span class="cyan">Data</span> × Intelligence'
LOCKUP_DARK = logo("auvetric-horizontal-dark-bg.png")
MANIFEST: list[dict] = []


def save(platform: str, name: str, w: int, h: int, html: str, *, use: str, spec: str, note: str = ""):
    out = OUT / platform / name
    render(html, out, w, h)
    MANIFEST.append({"platform": platform, "file": f"social/{platform}/{name}", "size": f"{w}x{h}", "use": use, "spec": spec, "note": note})
    print(f"  {platform}/{name}  {w}x{h}")


def avatar(platform: str, name: str, size: int, *, use: str, spec: str, light: bool = False):
    src = KIT / "logos" / ("auvetric-avatar-light-1024.png" if light else "auvetric-avatar-dark-1024.png")
    out = OUT / platform / name
    out.parent.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGB").resize((size, size), Image.Resampling.LANCZOS).save(out, optimize=True)
    MANIFEST.append({"platform": platform, "file": f"social/{platform}/{name}", "size": f"{size}x{size}", "use": use, "spec": spec, "note": "Symbol centred inside the circle-crop safe area."})
    print(f"  {platform}/{name}  {size}x{size}")


# ── Compositions ───────────────────────────────────────────────────────────────────────────────
def banner(w: int, h: int, *, text_x: float, text_w: float, node_x: float, node_r: float, head: float,
           show_logo: bool = True, logo_h: float | None = None, eyebrow: bool = True, sub: str | None = None,
           node_y: float | None = None, lanes: int = 5, text_y: float = .5, spread: float = .8, seed: int = 7,
           safe_note: str = "", align: str = "left") -> str:
    """Wide header: text block + convergence node. All geometry in px of the final asset."""
    lh = logo_h or head * .62
    ny = h * .5 if node_y is None else node_y
    parts = [background(w, h),
             convergence(w, h, node_x, ny, r=node_r, lanes=lanes, spread=spread, seed=seed, start_left=text_x + text_w + head * .4)]
    block = []
    if show_logo:
        block.append(f'<img src="{LOCKUP_DARK}" style="height:{lh:.0f}px;display:block;margin-bottom:{head*.42:.0f}px">')
    if eyebrow:
        block.append(f'<div class="mono" style="font-size:{head*.2:.0f}px;margin-bottom:{head*.3:.0f}px;color:{C["mute"]}">{EYEBROW}</div>')
    block.append(f'<div class="display" style="font-size:{head:.0f}px">{TAGLINE_1}<br><span class="mute">{TAGLINE_2}</span></div>')
    if sub:
        block.append(f'<div style="font-size:{head*.28:.0f}px;line-height:1.45;color:{C["mute"]};margin-top:{head*.32:.0f}px;max-width:{text_w:.0f}px">{sub}</div>')
    parts.append(f'<div style="position:absolute;left:{text_x:.0f}px;top:{h*text_y:.0f}px;transform:translateY(-50%);width:{text_w:.0f}px;text-align:{align}">{"".join(block)}</div>')
    return page(w, h, "".join(parts))


def logo_banner(w: int, h: int, *, logo_h: float, node: bool = False) -> str:
    """Little-to-no-text banner (Upwork agency banner rule): centred lockup on brand field."""
    parts = [background(w, h, grid=round(h / 4)),
             convergence(w, h, w / 2, h / 2, r=h * .32, lanes=4, spread=.9, seed=3, node=node, opacity=.85)]
    parts.append(f'<div class="layer" style="display:flex;align-items:center;justify-content:center"><img src="{LOCKUP_DARK}" style="height:{logo_h:.0f}px;padding:0 {h*.4:.0f}px;background:radial-gradient(closest-side,{C["void"]} 55%,transparent)"></div>')
    return page(w, h, "".join(parts))


def card(w: int, h: int, *, label: str, title: str, body: str = "", tone: str = "converge", footer: str = "",
         title_size: float | None = None, motif: str = "node", seed: int = 11, items: list[str] | None = None,
         quote_by: str = "", top_logo: bool = True, ui: str = "feed", item_cols: int = 1) -> str:
    """Content card for posts, stories, video covers, gig and project covers.

    Text and motif never share space: on portrait formats the convergence motif lives in a reserved
    bottom band; on landscape formats it lives in a reserved right-hand column.
    ui="story"/"tiktok" adds the platform's top and bottom UI-safe margins.
    """
    u = min(w, h) / 100
    ts = title_size or 8.5 * u
    landscape = w / h > 1.2
    accent = {"eng": C["blueInk"], "data": C["cyanInk"]}.get(tone, C["ink"])
    rule = {"eng": C["blue"], "data": C["cyan"]}
    rule_css = f"background:{rule[tone]}" if tone in rule else f"background:linear-gradient(90deg,{C['blue']},{C['cyan']})"
    pad_x = 8 * u
    pad_top, pad_bot = 8 * u, 7 * u
    if ui in ("story", "tiktok"):
        pad_top, pad_bot = 260, 340  # platform header / caption overlays at 1080x1920
    text_w = w * (.58 if landscape else (.74 if ui == "tiktok" else .82))

    if landscape:
        zx0, zy0, zx1, zy1 = w * .64, h * .12, w, h * .94
        cx, cy, r = w * .85, h * .56, h * .15
        motif_bottom = pad_bot
    else:
        zy0 = h * (.69 if ui == "feed" else .60)
        zy1 = h * (.87 if ui == "feed" else .80)  # feed: band ends above the footer line
        zx0, zx1 = 0, w
        cx, cy, r = w * .76, (zy0 + zy1) / 2, min(w, h) * .1
        motif_bottom = h - zy0 + 3 * u
    spread = (zy1 - zy0) / h * .8
    left = motif in ("node", "eng", "lanes")
    right = motif in ("node", "data", "lanes")
    parts = [background(w, h, glow=.9),
             convergence(w, h, cx, cy, r=r, lanes=4 if landscape else 5, spread=spread, seed=seed, opacity=.85,
                         left=left, right=right, node=motif != "lanes", start_left=zx0 + (0 if landscape else pad_x), start_right=zx1)]

    html = [f'<div style="position:absolute;left:{pad_x:.0f}px;top:{pad_top:.0f}px;bottom:{motif_bottom:.0f}px;width:{text_w:.0f}px;display:flex;flex-direction:column">']
    if top_logo:
        html.append(f'<img src="{LOCKUP_DARK}" style="height:{5.4*u:.0f}px;align-self:flex-start;flex:none;margin-bottom:{4*u:.0f}px">')
    html.append('<div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center">')
    html.append(f'<div style="height:{max(2,.28*u):.0f}px;width:{11*u:.0f}px;{rule_css};margin-bottom:{3.2*u:.0f}px"></div>')
    html.append(f'<div class="mono" style="font-size:{2.1*u:.0f}px;color:{accent};margin-bottom:{2.6*u:.0f}px">{label}</div>')
    html.append(f'<div class="display" style="font-size:{ts:.0f}px">{title}</div>')
    if body:
        html.append(f'<div style="font-size:{3.1*u:.0f}px;line-height:1.5;color:{C["mute"]};margin-top:{3.4*u:.0f}px">{body}</div>')
    if items:
        lis = "".join(f'<li style="display:flex;gap:{2.4*u:.0f}px;align-items:baseline;padding:{1.55*u:.0f}px 0;border-top:1px solid {C["line2"]}"><span class="mono" style="font-size:{1.9*u:.0f}px;color:{accent}">{i+1:02d}</span><span>{it}</span></li>' for i, it in enumerate(items))
        html.append(f'<ul style="list-style:none;margin-top:{3.8*u:.0f}px;font-size:{3.15*u:.0f}px;line-height:1.3;font-family:Space Grotesk;font-weight:500;display:grid;grid-template-columns:repeat({item_cols},1fr);column-gap:{5*u:.0f}px">{lis}</ul>')
    if quote_by:
        html.append(f'<div class="mono" style="font-size:{1.9*u:.0f}px;color:{C["mute"]};margin-top:{3.6*u:.0f}px">— {quote_by}</div>')
    html.append("</div></div>")
    if footer:
        html.append(f'<div class="mono" style="position:absolute;left:{pad_x:.0f}px;bottom:{(pad_bot if ui=="feed" else 4*u):.0f}px;font-size:{1.75*u:.0f}px;color:{C["dim"]}">{footer}</div>')
    return page(w, h, "".join(parts) + "".join(html))
