"""Build self-hosted Turkish-ready font subsets (TAS-03). Dev-time only; outputs are committed.

Usage: python scripts/fonts/subset.py <inter.ttf> <fraunces.ttf>
Sources: github.com/google/fonts ofl/inter/Inter[opsz,wght].ttf and ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf
Requires: fonttools + brotli (see D-012). One file per family covers Latin + Turkish, so a TR page
loads two files instead of four (latin + latin-ext) and stays under the 120 KB budget.
"""
import io
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

UNICODES = (
    list(range(0x20, 0x7F))            # Basic Latin
    + list(range(0xA0, 0x100))         # Latin-1 (ç ö ü â î û × ² ° …)
    + [0x011E, 0x011F, 0x0130, 0x0131, 0x015E, 0x015F]  # Ğ ğ İ ı Ş ş
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2032, 0x2033,
       0x20AC, 0x20BA, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2264, 0x2265]
)
FEATURES = ["kern", "liga", "calt", "tnum", "lnum", "locl", "ccmp", "mark", "mkmk"]

def build(src, out, axes):
    font = instantiateVariableFont(TTFont(src, lazy=False), axes)
    # Round-trip after instancing so every table is consistent before subsetting.
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    font = TTFont(buf, lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)
    print(out)

build(sys.argv[1], "src/assets/fonts/inter-tr-var.woff2", {"wght": (400, 600), "opsz": 14})
build(sys.argv[2], "src/assets/fonts/fraunces-tr-var.woff2", {"wght": (400, 600), "opsz": 72, "SOFT": 0, "WONK": 0})
