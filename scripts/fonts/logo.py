"""Convert the "Spa Dünyası" wordmark from Fraunces (wght 500, opsz 72, WONK 0) to SVG paths (TAS-08).
Dev-time only. Output: src/assets/logo/wordmark.json  {d, width, height, ascent}
Usage: python scripts/fonts/logo.py <Fraunces[SOFT,WONK,opsz,wght].ttf>
"""
import io, json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

TEXT = "Spa Dünyası"
font = instantiateVariableFont(TTFont(sys.argv[1], lazy=False), {"wght": 520, "opsz": 72, "SOFT": 0, "WONK": 0})
buf = io.BytesIO(); font.save(buf); buf.seek(0); font = TTFont(buf)
cmap = font.getBestCmap(); gs = font.getGlyphSet(); hmtx = font["hmtx"]
upm = font["head"].unitsPerEm
asc = font["hhea"].ascent; desc = font["hhea"].descent
# kerning via GPOS is skipped; apply light manual tracking instead
tracking = -0.01 * upm
x = 0.0
pen = SVGPathPen(gs)
for ch in TEXT:
    g = cmap[ord(ch)]
    tp = TransformPen(pen, (1, 0, 0, -1, x, asc))   # flip Y, baseline at asc
    gs[g].draw(tp)
    x += hmtx[g][0] + tracking
width = x - tracking
d = pen.getCommands()
out = {"d": d, "width": round(width), "height": asc - desc, "ascent": asc, "upm": upm}
import os; os.makedirs("src/assets/logo", exist_ok=True)
json.dump(out, open("src/assets/logo/wordmark.json", "w"), indent=0)
print(out["width"], out["height"], len(d))
