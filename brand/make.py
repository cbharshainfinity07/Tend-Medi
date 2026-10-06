import math
PINE='#1F5A4C'; CREAM='#F4F0E6'; AMBER='#E3A23A'; INK='#1B1A17'

def mark(ring=CREAM, cap_a=AMBER, cap_b=CREAM, seam=PINE, cx=50, cy=50, r=30, w=9.6, mono=None):
    """Ring = the day, three-quarters drawn. The capsule is the missing quarter: the dose completes the circle."""
    if mono: ring=cap_a=cap_b=mono
    a=math.radians(225)  # top-left, in screen space (y down)
    px, py = cx + r*math.cos(a), cy + r*math.sin(a)
    L=27
    # capsule drawn horizontally then rotated to the tangent (-45deg)
    cap = f'''<g transform="translate({px:.3f} {py:.3f}) rotate(-45)">
      <clipPath id="cl"><rect x="{-L/2}" y="{-w/2}" width="{L}" height="{w}" rx="{w/2}"/></clipPath>
      <g clip-path="url(#cl)"><rect x="{-L/2}" y="{-w/2}" width="{L/2}" height="{w}" fill="{cap_a}"/><rect x="0" y="{-w/2}" width="{L/2}" height="{w}" fill="{cap_b}"/></g>
    </g>'''
    arc=f'<path d="M{cx} {cy-r} A{r} {r} 0 1 1 {cx-r} {cy}" fill="none" stroke="{ring}" stroke-width="{w}" stroke-linecap="round"/>'
    return arc+cap

def svg(size, body, bg=None, scale=1.0, viewbox=100):
    s=scale; off=(viewbox-viewbox*s)/2
    bgr=f'<rect width="{viewbox}" height="{viewbox}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {viewbox} {viewbox}">{bgr}<g transform="translate({off} {off}) scale({s})">{body}</g></svg>'

files={
 'logo-mark.svg': svg(1024, mark(ring=PINE, cap_b=PINE, seam=CREAM)),             # for light backgrounds
 'logo-mark-light.svg': svg(1024, mark()),                                          # for dark backgrounds
 'app-icon.svg': svg(1024, mark(), bg=PINE, scale=0.8),
 'android-foreground.svg': svg(512, mark(), scale=0.62),                            # adaptive icon safe zone
 'android-background.svg': svg(512, '', bg=PINE),
 'android-monochrome.svg': svg(432, mark(mono='#FFFFFF'), scale=0.62),
 'splash.svg': svg(1024, mark(ring=PINE, cap_b=PINE, seam=CREAM), scale=0.55),
 'favicon.svg': svg(48, mark(), bg=PINE, scale=1.0),
}
for n,c in files.items(): open(n,'w').write(c)

# Wordmark lockup (needs Instrument Serif; rendered through Chrome with the web font)
lock=f'''<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@500&display=block" rel="stylesheet">
<style>html,body{{margin:0;background:transparent}}.l{{display:inline-flex;align-items:center;gap:40px;padding:40px 60px}}
.t{{font-family:'Instrument Serif';font-size:260px;line-height:1;color:{INK};letter-spacing:-4px}}
.s{{font-family:'Instrument Serif';font-style:italic;font-size:64px;color:{PINE};margin-top:-6px}}</style></head>
<body><div class="l">{svg(380, mark(ring=PINE, cap_b=PINE, seam=CREAM))}<div><div class="t">Tend</div><div class="s">Every dose, kept.</div></div></div></body></html>'''
open('lockup.html','w').write(lock)
for n,c in files.items():
    sz=int(c.split('width="')[1].split('"')[0])
    open(n.replace('.svg','.html'),'w').write(f'<!doctype html><html><head><style>html,body{{margin:0;background:transparent}}svg{{display:block}}</style></head><body>{c}</body></html>')
print('ok')
