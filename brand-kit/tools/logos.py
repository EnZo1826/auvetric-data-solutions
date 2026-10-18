"""Derive the Auvetric logo family from the owner-supplied master PNG.

No redrawing: every variant is cropped, recoloured or recomposited from the original pixels.
Run: python tools/logos.py   (from brand-kit/)
"""
from pathlib import Path
from PIL import Image, ImageChops, PngImagePlugin
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT.parent / "public/brand/auvetric-logo-original.png"
OUT = ROOT / "logos"
OUT.mkdir(exist_ok=True)

NAVY_BG = (5, 11, 24, 255)        # #050B18 brand void
WHITE = (243, 247, 255)           # #F3F7FF brand ink
NAVY_INK = (6, 20, 51)            # #061433 — sampled family of the master wordmark navy


def meta(desc: str) -> PngImagePlugin.PngInfo:
    i = PngImagePlugin.PngInfo()
    i.add_text("Source", f"Derived from owner-supplied Auvetric master logo. {desc}")
    return i


def trim(im: Image.Image) -> Image.Image:
    return im.crop(im.getbbox())


def is_ink(px) -> bool:
    r, g, b, a = px
    return a > 0 and r < 70 and g < 105 and b < 160  # dark navy lettering / trace


def recolour_ink(im: Image.Image, rgb, box=None) -> Image.Image:
    """Recolour navy ink pixels, optionally only inside box=(x0, y0, x1, y1)."""
    im = im.copy(); p = im.load()
    x0, y0, x1, y1 = box or (0, 0, im.width, im.height)
    for y in range(max(0, y0), min(im.height, y1)):
        for x in range(max(0, x0), min(im.width, x1)):
            if is_ink(p[x, y]):
                p[x, y] = (*rgb, p[x, y][3])
    return im


def mono(im: Image.Image, rgb) -> Image.Image:
    solid = Image.new("RGBA", im.size, (*rgb, 255))
    solid.putalpha(im.getchannel("A"))
    return solid


def lockup(mark: Image.Image, word: Image.Image, height: int = 400) -> Image.Image:
    """Horizontal lockup: mark height = lockup height; wordmark 62% of it, gap = 18% of height."""
    m = mark.resize((round(mark.width * height / mark.height), height), Image.Resampling.LANCZOS)
    wh = round(height * 0.62)
    w = word.resize((round(word.width * wh / word.height), wh), Image.Resampling.LANCZOS)
    gap = round(height * 0.18)
    canvas = Image.new("RGBA", (m.width + gap + w.width, height))
    canvas.alpha_composite(m, (0, 0))
    canvas.alpha_composite(w, (m.width + gap, (height - wh) // 2))
    return canvas


def on_tile(mark: Image.Image, size: int, bg, fill: float = 0.74) -> Image.Image:
    tile = Image.new("RGBA", (size, size), bg)
    m = mark.copy(); m.thumbnail((round(size * fill), round(size * fill)), Image.Resampling.LANCZOS)
    tile.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return tile


def main():
    src = Image.open(MASTER).convert("RGBA")
    # On dark grounds only two things change: the navy wordmark becomes white and the single navy
    # circuit terminal (master coords ~985-1175 x 600-725) becomes light brand blue. The symbol's
    # navy shadow facets are deliberately untouched — whitening them breaks the ribbon's depth.
    TERMINAL = (985, 600, 1175, 725)
    LIGHT_BLUE = (119, 181, 255)  # #77B5FF
    src_dark = recolour_ink(src, LIGHT_BLUE, TERMINAL)
    src_dark = recolour_ink(src_dark, WHITE, (0, 815, src.width, src.height))

    MARK_BOX, WORD_BOX = (175, 150, 1290, 805), (30, 815, 1285, 1155)
    mark, word, stacked = trim(src.crop(MARK_BOX)), trim(src.crop(WORD_BOX)), trim(src)
    mark_dark = src_dark.crop(MARK_BOX).crop(src.crop(MARK_BOX).getbbox())
    word_dark = src_dark.crop(WORD_BOX).crop(src.crop(WORD_BOX).getbbox())
    stacked_dark = src_dark.crop(src.getbbox())

    files = {
        "auvetric-mark.png": (mark, "Symbol only, original colours."),
        "auvetric-mark-on-dark.png": (mark_dark, "Symbol for dark grounds: only the navy circuit terminal is lightened to brand blue."),
        "auvetric-horizontal-light-bg.png": (lockup(mark, word), "Horizontal lockup, original navy wordmark, for light backgrounds."),
        "auvetric-horizontal-dark-bg.png": (lockup(mark_dark, word_dark), "Horizontal lockup, white wordmark, for dark backgrounds."),
        "auvetric-stacked-light-bg.png": (stacked, "Master stacked logo, original colours."),
        "auvetric-stacked-dark-bg.png": (stacked_dark, "Stacked logo, white wordmark for dark backgrounds."),
        "auvetric-horizontal-mono-white.png": (mono(lockup(mark, word), WHITE), "Single-colour white, for photos and dark single-colour use."),
        "auvetric-horizontal-mono-navy.png": (mono(lockup(mark, word), NAVY_INK), "Single-colour navy, for light single-colour use."),
        "auvetric-mark-mono-white.png": (mono(mark, WHITE), "Symbol single-colour white."),
        "auvetric-mark-mono-navy.png": (mono(mark, NAVY_INK), "Symbol single-colour navy."),
        "auvetric-avatar-dark-1024.png": (on_tile(mark_dark, 1024, NAVY_BG), "Square avatar: symbol on brand navy. Circle-safe."),
        "auvetric-avatar-light-1024.png": (on_tile(mark, 1024, (255, 255, 255, 255)), "Square avatar: symbol on white. Circle-safe."),
    }
    manifest = {"master": str(MASTER.name), "masterSha256": hashlib.sha256(MASTER.read_bytes()).hexdigest(), "files": {}}
    for name, (im, desc) in files.items():
        im.save(OUT / name, optimize=True, pnginfo=meta(desc))
        manifest["files"][name] = {"size": im.size, "use": desc}
    (OUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))
    for k, v in manifest["files"].items():
        print(f"{k:40} {v['size']}")


if __name__ == "__main__":
    main()
