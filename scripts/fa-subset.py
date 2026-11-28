#!/usr/bin/env python3
"""Rebuild public/fa (Font Awesome 6.4.0 subset).
Keeps every fa-* class that appears anywhere in the repo source (all themes) plus extra names
passed as arguments (e.g. icons used only in Notion-configured menus). Needs fonttools + brotli.
Usage: python3 scripts/fa-subset.py [fa-extra-icon ...]"""
import re, subprocess, sys, os, urllib.request, tempfile
V = '6.4.0'; BASE = f'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/{V}/'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp()
def get(p):
    out = os.path.join(tmp, os.path.basename(p)); urllib.request.urlretrieve(BASE + p, out); return out
css = open(get('css/all.min.css')).read()
src = subprocess.run(['git', 'grep', '-ohE', r'\bfa-[a-z0-9-]+', '--', '.', ':!public', ':!*.css', ':!*.lock'],
                     cwd=root, capture_output=True, text=True).stdout.split()
names = {t[3:] for t in src + sys.argv[1:]}
rules, buf, d = [], '', 0
for ch in css:
    buf += ch
    if ch == '{': d += 1
    elif ch == '}':
        d -= 1
        if d == 0: rules.append(buf); buf = ''
res, cps = [], set()
for r in rules:
    sel, body = r.split('{', 1); sels = sel.split(',')
    if all(re.fullmatch(r'\.fa-[a-z0-9-]+:(?:before|after)', s.strip()) for s in sels) and 'content:' in body:
        keep = [s for s in sels if s.strip()[4:].split(':')[0] in names]
        if keep:
            res.append(','.join(keep) + '{' + body)
            cps |= {int(m, 16) for m in re.findall(r'content:"\\([0-9a-f]+)', body)}
    else:
        res.append(r)
out = re.sub(r',url\(\.\./webfonts/[a-z0-9-]+\.ttf\) format\("truetype"\)', '', ''.join(res))
os.makedirs(os.path.join(root, 'public/fa/css'), exist_ok=True); os.makedirs(os.path.join(root, 'public/fa/webfonts'), exist_ok=True)
open(os.path.join(root, 'public/fa/css/all.min.css'), 'w').write(out)
uni = ','.join('U+%04X' % c for c in sorted(cps))
for f in ['fa-solid-900', 'fa-regular-400', 'fa-brands-400', 'fa-v4compatibility']:
    src_font = get(f'webfonts/{f}.woff2'); dst = os.path.join(root, f'public/fa/webfonts/{f}.woff2')
    r = subprocess.run(['pyftsubset', src_font, f'--unicodes={uni}', '--flavor=woff2', '--layout-features=*', f'--output-file={dst}'])
    if r.returncode: subprocess.run(['cp', src_font, dst])  # some upstream woff2 files can't be re-subset; ship as-is
print(len(names), 'names,', len(cps), 'icons')
