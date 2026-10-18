"""Contact sheets for reviewing every generated asset. Run: python tools/contact_sheet.py"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

KIT = Path(__file__).resolve().parents[1]
items = json.loads((KIT / "social/MANIFEST.json").read_text())
out_dir = KIT / "social"
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 18)

groups = {
    "wide": [i for i in items if (lambda w, h: w / h > 1.5)(*map(int, i["size"].split("x")))],
    "portrait": [i for i in items if (lambda w, h: w / h < .9)(*map(int, i["size"].split("x")))],
    "card": [i for i in items if (lambda w, h: .9 <= w / h <= 1.5 and w != h)(*map(int, i["size"].split("x")))],
    "square": [i for i in items if (lambda w, h: w == h)(*map(int, i["size"].split("x")))],
}
for name, its in groups.items():
    if not its:
        continue
    cell_w = {"wide": 1560, "portrait": 380, "card": 760, "square": 240}[name]
    cols = {"wide": 1, "portrait": 6, "card": 3, "square": 8}[name]
    thumbs = []
    for it in its:
        im = Image.open(KIT / it["file"]).convert("RGB")
        im.thumbnail((cell_w, 10_000))
        thumbs.append((it, im))
    rows = [thumbs[i:i + cols] for i in range(0, len(thumbs), cols)]
    H = sum(max(t[1].height for t in r) + 40 for r in rows) + 20
    sheet = Image.new("RGB", (cols * (cell_w + 20) + 20, H), (40, 40, 44))
    d = ImageDraw.Draw(sheet); y = 20
    for r in rows:
        x = 20
        for it, im in r:
            sheet.paste(im, (x, y)); d.text((x, y + im.height + 6), f'{it["file"].split("/")[-1]}', fill=(220, 220, 220), font=font)
            x += cell_w + 20
        y += max(t[1].height for t in r) + 40
    p = out_dir / f"_contact-sheet-{name}.png"
    sheet.save(p)
    print(p, sheet.size)
