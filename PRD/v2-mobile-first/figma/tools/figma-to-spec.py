"""Figma REST `GET /v1/files/:key/nodes` response -> compact spec JSON, one file per screen (the `specs/` format).

Usage: python3 figma-to-spec.py nodes.json <node-id> <out.json> [<node-id> <out.json> ...]
"""
import json, sys
KEEP = ['id','name','type','visible','boundVariables','componentId','componentProperties','clipsContent','fills','strokes','strokeWeight','strokeAlign','cornerRadius','rectangleCornerRadii','opacity','effects','constraints','layoutMode','layoutWrap','layoutPositioning','layoutAlign','layoutGrow','layoutSizingHorizontal','layoutSizingVertical','primaryAxisSizingMode','counterAxisSizingMode','primaryAxisAlignItems','counterAxisAlignItems','counterAxisSpacing','itemSpacing','paddingLeft','paddingRight','paddingTop','paddingBottom','characters','style']
STYLE = ['fontFamily','fontWeight','fontSize','lineHeightPx','letterSpacing','textAlignHorizontal']
def conv(n, ox, oy):
    out = {}
    for k, v in n.items():
        if k not in KEEP or (isinstance(v, (list, dict)) and not v): continue
        out[k] = {sk: v[sk] for sk in STYLE if sk in v} if k == 'style' else v
    bb = n.get('absoluteBoundingBox')
    if bb: out['box'] = {'x': round(bb['x']-ox, 1), 'y': round(bb['y']-oy, 1), 'w': round(bb['width'], 1), 'h': round(bb['height'], 1)}
    if n.get('children') and not n['name'].startswith('icon/'): out['children'] = [conv(c, ox, oy) for c in n['children']]
    return out
def find(n, i):
    if n.get('id') == i: return n
    for c in n.get('children', []):
        if (r := find(c, i)): return r
full = json.load(open(sys.argv[1]))
for i, path in zip(sys.argv[2::2], sys.argv[3::2]):
    raw = next(r for v in full['nodes'].values() if (r := find(v['document'], i)))
    bb = raw['absoluteBoundingBox']
    json.dump(conv(raw, bb['x'], bb['y']), open(path, 'w'), separators=(',', ':'))
