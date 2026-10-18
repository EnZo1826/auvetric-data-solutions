"""Auvetric brand system for generated assets: tokens, motifs and a headless-Chrome renderer.

Every social graphic is HTML/CSS/SVG rendered at its exact platform pixel size, so type is the
real brand fonts (self-hosted in ../fonts) and every asset shares one source of truth.
"""
from __future__ import annotations

import math
import random
import subprocess
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
FONTS_CSS = (KIT / "fonts" / "fonts.css").as_uri()
LOGOS = KIT / "logos"
CHROME_CANDIDATES = [
    Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
    Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
]

# ── Tokens (identical to the website's globals.css) ─────────────────────────────────────────────
C = {
    "void": "#050B18", "base": "#091326", "panel": "#101E34", "raised": "#172B46",
    "line": "#203651", "line2": "#304D70",
    "ink": "#F3F7FF", "mute": "#9DAFC8", "dim": "#8298B5",
    "blue": "#0069F5", "blueInk": "#77B5FF", "blueDeep": "#0A2247",
    "cyan": "#00D4EA", "cyanInk": "#5AE7F2", "cyanDeep": "#073040",
    "ok": "#49D7B1", "warn": "#F0B35A", "danger": "#F16B77",
    "navyInk": "#061433",
}


def logo(name: str) -> str:
    return (LOGOS / name).as_uri()


BASE_CSS = f"""
@import url('{FONTS_CSS}');
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:100%;height:100%;overflow:hidden}}
body{{background:{C['void']};color:{C['ink']};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;position:relative}}
.display{{font-family:'Space Grotesk',sans-serif;font-weight:600;letter-spacing:-0.035em;line-height:.98}}
.mono{{font-family:'JetBrains Mono',monospace;font-weight:500;letter-spacing:.16em;text-transform:uppercase}}
.mute{{color:{C['mute']}}} .blue{{color:{C['blueInk']}}} .cyan{{color:{C['cyanInk']}}}
.layer{{position:absolute;inset:0}}
.grid{{background-image:linear-gradient(rgba(157,175,200,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(157,175,200,.07) 1px,transparent 1px);
  -webkit-mask-image:radial-gradient(ellipse 85% 80% at 50% 45%,#000 25%,transparent 88%)}}
.rule{{height:2px;background:linear-gradient(90deg,{C['blue']},{C['cyan']})}}
"""


def background(w: int, h: int, *, grid: int | None = None, glow: float = 1.0, glow_at=("14% 30%", "86% 72%")) -> str:
    g = grid or max(24, round(min(w, h) / 9))
    a, b = glow_at
    return f"""
<div class="layer" style="background:
  radial-gradient(ellipse {round(w*.55)}px {round(h*.9)}px at {a}, rgba(0,105,245,{.30*glow}), transparent 70%),
  radial-gradient(ellipse {round(w*.5)}px {round(h*.85)}px at {b}, rgba(0,212,234,{.20*glow}), transparent 70%),
  {C['void']}"></div>
<div class="layer grid" style="background-size:{g}px {g}px;background-position:-1px -1px"></div>"""


def convergence(w: int, h: int, cx: float, cy: float, *, r: float, lanes: int = 5, spread: float = .8,
                seed: int = 7, opacity: float = 1.0, left: bool = True, right: bool = True,
                node: bool = True, start_left: float = 0, start_right: float | None = None) -> str:
    """Signature motif: blue (engineering) and cyan (data) signal paths converging on one node,
    each starting at a ring terminal like the circuit traces in the Auvetric symbol."""
    rnd = random.Random(seed)
    start_right = w if start_right is None else start_right
    s = max(1.0, min(w, h) / 420)  # stroke scale
    out = [f'<svg class="layer" viewBox="0 0 {w} {h}" width="{w}" height="{h}" style="opacity:{opacity}" xmlns="http://www.w3.org/2000/svg">',
           '<defs>',
           f'<linearGradient id="gb" x1="0" x2="1"><stop offset="0" stop-color="{C["blue"]}" stop-opacity=".95"/><stop offset="1" stop-color="{C["blue"]}" stop-opacity=".2"/></linearGradient>',
           f'<linearGradient id="gc" x1="1" x2="0"><stop offset="0" stop-color="{C["cyan"]}" stop-opacity=".95"/><stop offset="1" stop-color="{C["cyan"]}" stop-opacity=".2"/></linearGradient>',
           f'<radialGradient id="glw"><stop offset="0" stop-color="#F3F7FF" stop-opacity=".55"/><stop offset="1" stop-color="#F3F7FF" stop-opacity="0"/></radialGradient>',
           '</defs>']

    def side(sign: int, x0: float, grad: str, ink: str):
        for i in range(lanes):
            t = (i - (lanes - 1) / 2) / max(1, (lanes - 1) / 2)
            y0 = cy + t * h * spread / 2  # even spacing: terminal rings never overlap
            ang = t * .62
            ex = cx - sign * math.cos(ang) * r
            ey = cy + math.sin(ang) * r
            c1x = x0 + sign * abs(ex - x0) * .55
            c2x = ex - sign * abs(ex - x0) * .30
            out.append(f'<path d="M {x0:.1f} {y0:.1f} C {c1x:.1f} {y0:.1f}, {c2x:.1f} {ey:.1f}, {ex:.1f} {ey:.1f}" fill="none" stroke="url(#{grad})" stroke-width="{1.4*s:.2f}"/>')
            tx = x0 + sign * 26 * s
            if 0 < tx < w:
                out.append(f'<circle cx="{tx:.1f}" cy="{y0:.1f}" r="{5.5*s:.1f}" fill="{C["void"]}" stroke="{ink}" stroke-width="{2.2*s:.1f}"/>')
                out.append(f'<path d="M {tx + sign*5.5*s:.1f} {y0:.1f} H {x0 + sign*60*s:.1f}" stroke="{ink}" stroke-width="{2.2*s:.1f}" />')
            pt = rnd.uniform(.35, .75)  # a data packet on the path
            px = (1 - pt) ** 3 * x0 + 3 * (1 - pt) ** 2 * pt * c1x + 3 * (1 - pt) * pt ** 2 * c2x + pt ** 3 * ex
            py = (1 - pt) ** 3 * y0 + 3 * (1 - pt) ** 2 * pt * y0 + 3 * (1 - pt) * pt ** 2 * ey + pt ** 3 * ey
            out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{2.6*s:.1f}" fill="{ink}"/>')

    if left:
        side(1, start_left, "gb", C["blueInk"])
    if right:
        side(-1, start_right, "gc", C["cyanInk"])
    if node:
        ticks = []
        for i in range(96):
            a = i / 96 * math.tau
            r1, r2 = r * 1.04, r * (1.16 if i % 8 == 0 else 1.09)
            ticks.append(f'<line x1="{cx+math.cos(a)*r1:.1f}" y1="{cy+math.sin(a)*r1:.1f}" x2="{cx+math.cos(a)*r2:.1f}" y2="{cy+math.sin(a)*r2:.1f}" stroke="#F3F7FF" stroke-opacity="{.5 if i%8==0 else .16}" stroke-width="{s:.2f}"/>')
        out += ticks
        out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r*.73:.1f}" ry="{r*.26:.1f}" fill="none" stroke="{C["blue"]}" stroke-opacity=".9" stroke-width="{1.5*s:.2f}" transform="rotate(-28 {cx} {cy})"/>')
        out.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r*.78:.1f}" ry="{r*.31:.1f}" fill="none" stroke="{C["cyan"]}" stroke-opacity=".9" stroke-width="{1.5*s:.2f}" transform="rotate(32 {cx} {cy})"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r*.36:.1f}" fill="none" stroke="#F3F7FF" stroke-opacity=".35" stroke-dasharray="{2*s:.1f} {5*s:.1f}" stroke-width="{s:.2f}"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r*.3:.1f}" fill="url(#glw)"/>')
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{r*.12:.1f}" fill="#F3F7FF"/>')
    out.append("</svg>")
    return "\n".join(out)


def trace(width: float, *, color: str = C["cyanInk"], scale: float = 1.0) -> str:
    """Inline circuit-trace divider ending in a ring terminal (from the logo's traces)."""
    s = scale
    return (f'<svg width="{width}" height="{16*s}" viewBox="0 0 {width} {16*s}" style="display:block">'
            f'<path d="M0 {8*s} H {width-22*s}" stroke="url(#tg)" stroke-width="{2.4*s}"/>'
            f'<defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stop-color="{C["blue"]}"/><stop offset="1" stop-color="{color}"/></linearGradient></defs>'
            f'<circle cx="{width-11*s}" cy="{8*s}" r="{6*s}" fill="none" stroke="{color}" stroke-width="{2.6*s}"/></svg>')


def page(w: int, h: int, body: str, css: str = "") -> str:
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
body{{width:{w}px;height:{h}px}}{css}</style></head><body>{body}</body></html>"""


def chrome() -> Path:
    for c in CHROME_CANDIDATES:
        if c.exists():
            return c
    raise FileNotFoundError("Chrome or Edge is required for rendering")


def render(html: str, out: Path, w: int, h: int, *, transparent: bool = False) -> Path:
    """Render HTML to an exact-size PNG with headless Chrome. Raises if the output size is wrong."""
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=KIT / "tools") as td:
        src = Path(td) / "asset.html"
        src.write_text(html, encoding="utf-8")
        cmd = [str(chrome()), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
               "--force-device-scale-factor=1", f"--window-size={w},{h}", "--virtual-time-budget=4000",
               f"--user-data-dir={Path(td) / 'profile'}", f"--screenshot={out}"]
        if transparent:
            cmd.append("--default-background-color=00000000")
        subprocess.run(cmd + [src.as_uri()], check=True, capture_output=True, timeout=120)
    from PIL import Image
    with Image.open(out) as im:
        if im.size != (w, h):
            raise RuntimeError(f"{out.name}: rendered {im.size}, expected {(w, h)}")
    return out
