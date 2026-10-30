"""Genera el logo de HYSKAD (engranaje + llave) como SVG limpio y todas sus variantes."""
import math, os, sys, io
from shapely.geometry import Point, Polygon, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg
from PIL import Image

OUT = sys.argv[1]
FONT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def rnd(g, convex=7, concave=5):
    return g.buffer(-convex, join_style=1).buffer(convex + concave, join_style=1).buffer(-concave, join_style=1)

def to_path(g):
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    d = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            d.append("M" + "L".join(f"{x:.1f} {y:.1f}".replace(".0 ", " ") for x, y in pts) + "Z")
    return " ".join(d)

# ---------- Engranaje ----------
GC = (192, 326)
def gear(cx, cy, n=9, ro=150, rr=120, hole=52):
    pts = []
    tooth = 2 * math.pi / n
    for i in range(n):
        a = i * tooth - math.pi / 2
        for t, r in [(0.00, rr), (0.14, ro), (0.42, ro), (0.56, rr)]:
            ang = a + t * tooth
            pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    g = Polygon(pts).union(Point(cx, cy).buffer(rr, 128))
    g = rnd(g, 8, 6)
    return g.difference(Point(cx, cy).buffer(hole, 128))

# ---------- Llave ----------
def wrench():
    shaft = box(-175, -27, 175, 27)
    jaw = Point(205, 0).buffer(76, 128)
    ring = Point(-205, 0).buffer(58, 128)
    w = unary_union([shaft, jaw, ring])
    w = rnd(w, 6, 22)
    slot = affinity.rotate(box(198, -31, 330, 31), 15, origin=(205, 0))
    slot = slot.union(affinity.rotate(Point(198, 0).buffer(31, 64), 15, origin=(205, 0)))
    hexa = Polygon([(-205 + 30 * math.cos(math.radians(60 * k)), 30 * math.sin(math.radians(60 * k))) for k in range(6)])
    w = w.difference(slot).difference(hexa)
    w = rnd(w, 4, 0.1)
    w = affinity.rotate(w, 225, origin=(0, 0))      # mandíbula arriba a la izquierda
    return affinity.translate(w, 280, 250)

W = wrench()
G = gear(*GC).difference(W.buffer(15, join_style=1))
if G.geom_type == "MultiPolygon":
    G = max(G.geoms, key=lambda g: g.area)
G = rnd(G, 3, 0.1)
BOLT = Point(*GC).buffer(22, 96)

G = G.simplify(0.35, preserve_topology=True); W = W.simplify(0.35, preserve_topology=True)
BOLT = BOLT.simplify(0.35, preserve_topology=True)
mark_paths = {"gear": to_path(G), "wrench": to_path(W), "bolt": to_path(BOLT)}

# bounding box real del símbolo para recortar el viewBox
allg = unary_union([G, W])
minx, miny, maxx, maxy = allg.bounds
pad = 14
VB = (math.floor(minx - pad), math.floor(miny - pad), math.ceil(maxx - minx + 2 * pad), math.ceil(maxy - miny + 2 * pad))
side = max(VB[2], VB[3])
cx0 = (minx + maxx) / 2; cy0 = (miny + maxy) / 2
VBSQ = (round(cx0 - side / 2), round(cy0 - side / 2), side, side)

PALETTES = {
    # gear, wrench(stop1, stop2), bolt
    "color": dict(g1="#1A46B5", g2="#0F1D3F", w1="#5698FF", w2="#1D58E0", bolt="#38BDF8"),
    "dark":  dict(g1="#5698FF", g2="#2F74F5", w1="#FFFFFF", w2="#BBD6FF", bolt="#38BDF8"),
}

def defs(p, uid):
    return f'''<defs>
    <linearGradient id="{uid}g" x1="60" y1="150" x2="330" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{p['g1']}"/><stop offset="1" stop-color="{p['g2']}"/>
    </linearGradient>
    <linearGradient id="{uid}w" x1="110" y1="80" x2="440" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{p['w1']}"/><stop offset="1" stop-color="{p['w2']}"/>
    </linearGradient>
  </defs>'''

def mark_body(p, uid):
    return f'''<path fill="url(#{uid}g)" fill-rule="evenodd" d="{mark_paths['gear']}"/>
  <path fill="url(#{uid}w)" fill-rule="evenodd" d="{mark_paths['wrench']}"/>
  <path fill="{p['bolt']}" d="{mark_paths['bolt']}"/>'''

def svg(vb, body, title, extra=""):
    v = " ".join(str(x) for x in vb)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{v}" role="img" aria-labelledby="t"{extra}>
  <title id="t">{title}</title>
  {body}
</svg>
'''

files = {}
for name, pal in PALETTES.items():
    files[f"logo-mark{'' if name=='color' else '-on-dark'}.svg"] = svg(VBSQ, defs(pal, "m") + "\n  " + mark_body(pal, "m"), "HYSKAD")

# monocromo (hereda color con currentColor) – para íconos inline y sellos
mono = f'''<path fill="currentColor" fill-rule="evenodd" d="{mark_paths['gear']} {mark_paths['wrench']}"/>
  <path fill="currentColor" d="{mark_paths['bolt']}"/>'''
files["logo-mark-mono.svg"] = svg(VBSQ, mono, "HYSKAD")

# ---------- Ícono de app (insignia) ----------
def app_icon(size=512, radius=116, maskable=False, fill=None):
    # el símbolo ocupa ~70% (o ~58% en maskable, zona segura)
    scale = (fill or (0.58 if maskable else 0.70)) * size / side
    tx = size / 2 - (VBSQ[0] + side / 2) * scale
    ty = size / 2 - (VBSQ[1] + side / 2) * scale
    r = 0 if maskable else radius
    pal = PALETTES["dark"]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="{size}" y2="{size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1D58E0"/><stop offset="0.55" stop-color="#1B3570"/><stop offset="1" stop-color="#0F1D3F"/>
    </linearGradient>
    <radialGradient id="glow" cx="{size*0.28}" cy="{size*0.2}" r="{size*0.75}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8CBCFF" stop-opacity="0.35"/><stop offset="1" stop-color="#8CBCFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ag" x1="60" y1="150" x2="330" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8CBCFF"/><stop offset="1" stop-color="#5698FF"/>
    </linearGradient>
    <linearGradient id="aw" x1="110" y1="80" x2="440" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D9E8FF"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{r}" fill="url(#bg)"/>
  <rect width="{size}" height="{size}" rx="{r}" fill="url(#glow)"/>
  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f})">
    <path fill="url(#ag)" fill-rule="evenodd" d="{mark_paths['gear']}"/>
    <path fill="url(#aw)" fill-rule="evenodd" d="{mark_paths['wrench']}"/>
    <path fill="{pal['bolt']}" d="{mark_paths['bolt']}"/>
  </g>
</svg>
'''
files["app-icon.svg"] = app_icon()
files["app-icon-maskable.svg"] = app_icon(maskable=True)
files["favicon.svg"] = app_icon(radius=110, fill=0.88)

# ---------- Logotipo horizontal (símbolo + HYSKAD en curvas) ----------
font = TTFont(FONT)
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font["head"].unitsPerEm
def text_path(txt, size, tracking):
    pen = SVGPathPen(gs); x = 0.0; s = size / upm
    for ch in txt:
        gname = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, x, 0))
        gs[gname].draw(tp)
        x += gs[gname].width * s + tracking
    return pen.getCommands(), x - tracking
cap = font["OS/2"].sCapHeight
FS = 300
d_text, tw = text_path("HYSKAD", FS, 6)
cap_px = cap * FS / upm
mark_h = side
gap = 56
# símbolo escalado para que su alto ≈ 1.45 × altura de mayúsculas
ms = (cap_px * 2.05) / mark_h
mw = side * ms
text_x = mw + gap
text_base = (mark_h * ms) / 2 + cap_px / 2   # centra mayúsculas con el símbolo
total_w = text_x + tw
H = mark_h * ms

def horizontal(pal, text_color, uid):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:.0f} {H:.0f}" role="img" aria-labelledby="t">
  <title id="t">HYSKAD</title>
  {defs(pal, uid)}
  <g transform="scale({ms:.5f}) translate({-VBSQ[0]} {-VBSQ[1]})">
  {mark_body(pal, uid)}
  </g>
  <path fill="{text_color}" transform="translate({text_x:.1f} {text_base:.1f})" d="{d_text}"/>
</svg>
'''
files["logo.svg"] = horizontal(PALETTES["color"], "#0F1D3F", "h")
files["logo-on-dark.svg"] = horizontal(PALETTES["dark"], "#FFFFFF", "h")

for fn, content in files.items():
    with open(os.path.join(OUT, fn), "w") as f:
        f.write(content)

# ---------- PNG / ICO ----------
def png(svgname, w, out, h=None):
    cairosvg.svg2png(url=os.path.join(OUT, svgname), write_to=os.path.join(OUT, out), output_width=w, output_height=h)

png("favicon.svg", 32, "favicon-32.png")
png("favicon.svg", 16, "favicon-16.png")
png("app-icon.svg", 180, "apple-touch-icon.png")   # iOS aplica su propio redondeo; usamos maskable abajo
png("app-icon-maskable.svg", 180, "apple-touch-icon.png")
png("app-icon.svg", 192, "icon-192.png")
png("app-icon.svg", 512, "icon-512.png")
png("app-icon-maskable.svg", 512, "icon-maskable-512.png")
png("logo.svg", 480, "logo-email.png")              # los clientes de correo no muestran SVG
png("logo-mark.svg", 1024, "logo-mark-1024.png")
imgs = [Image.open(io.BytesIO(cairosvg.svg2png(url=os.path.join(OUT, "favicon.svg"), output_width=s, output_height=s))) for s in (16, 32, 48)]
imgs[2].save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], append_images=imgs[:2])

print("viewBox mark:", VBSQ, "horizontal:", round(total_w), round(H))
