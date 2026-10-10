"""Package public evaluation photos for the explicit localhost browser harness.

This reads only manifest-listed research photos, verifies each hash, and writes
one ignored fixture. It does not expose a directory or send files to a service.
"""
import argparse
import base64
import hashlib
import json
import mimetypes
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--manifest', required=True)
parser.add_argument('--split', choices=('calibration', 'holdout'), required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
manifest = Path(args.manifest).resolve()
samples = json.loads(manifest.read_text(encoding='utf-8'))['samples']
result = []
for sample in samples:
    if sample['split'] != args.split:
        continue
    photo = (manifest.parent / sample['image_path']).resolve()
    data = photo.read_bytes()
    if hashlib.sha256(data).hexdigest() != sample['sha256']:
        raise ValueError(f"Changed sample: {sample['id']}")
    result.append({
        'id': sample['id'], 'slug': sample['slug'], 'kind': sample['kind'],
        'split': sample['split'], 'label': (sample['slug'] or sample['id']).replace('_', ' '),
        'source_url': sample.get('source_url', ''), 'license': sample.get('license', ''),
        'data_url': f"data:{mimetypes.guess_type(photo.name)[0]};base64," + base64.b64encode(data).decode('ascii'),
    })
Path(args.output).write_text(json.dumps(result), encoding='utf-8')
print(f'Packaged {len(result)} {args.split} photos for the localhost browser check.')
