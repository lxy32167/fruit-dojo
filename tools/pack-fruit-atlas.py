"""Pack the APK-derived sprite exports for one-request browser loading."""
from pathlib import Path
from PIL import Image
import json
import math
import sys
root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'dist/assets/fruits'
records = []
for source in ('sources.json', 'pomegranate-sources.json', 'dragonfruit-sources.json', 'bomb-sources.json'):
    records.extend(json.loads((root / source).read_text()))
keys = sorted({Path(record['file']).stem for record in records})
size, columns = 320, 8
atlas = Image.new('RGBA', (columns * size, math.ceil(len(keys) / columns) * size))
manifest = {}
for i, key in enumerate(keys):
    sprite = Image.open(root / (key + '.webp')).convert('RGBA')
    if sprite.size != (size, size):
        raise ValueError(f'Unexpected sprite dimensions: {key} {sprite.size}')
    x, y = i % columns * size, i // columns * size
    atlas.paste(sprite, (x, y))
    manifest[key] = [x, y, size, size]
atlas.save(root / 'atlas.webp', quality=94)
(root / 'atlas.json').write_text(json.dumps(manifest, separators=(',', ':')))
print(f'Packed {len(keys)} original sprites.')
