"""Build a small, traceable Explore-only photo benchmark, never a training claim.

The source catalogues describe reuse licences; image pixels still need a human
visual review. Run ``collect`` first, review the contact sheets, then ``finalize``
with the checked row IDs. No Take action model or production database is touched.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import random
import shutil
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/explore-ai/dataset'
OLD = Path(r'C:\Users\sansk\Downloads\FixForward-Iteration-3-From-Iteration-2')
OLD_MANIFEST = OLD / 'tmp/appliance-model-experiment-v3/selected-data-manifest.jsonl'
ACTIVE = ['kettle', 'toaster', 'fan', 'microwave', 'blender', 'rice_cooker',
          'air_fryer', 'coffee_machine', 'mixer', 'vacuum_cleaner', 'hair_dryer',
          'laptop', 'smartphone', 'tablet', 'television', 'washing_machine']
NEW_QUERIES = {
    'laptop': ['laptop computer', 'Thinkpad laptop'],
    'smartphone': ['smartphone phone', 'Samsung Galaxy smartphone'],
    'tablet': ['tablet computer', 'iPad tablet'],
    'television': ['television set', 'flat screen television'],
    'washing_machine': ['washing machine', 'front loading washing machine'],
}
HEADERS = {'User-Agent': 'FixForwardResearch/4.0 (educational licensed image evaluation; https://fixforward.me/)'}
API = 'https://api.openverse.org/v1/images/'


def digest(path: Path) -> str:
    """Hash the actual local photo, so evidence cannot silently change later."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def dhash(image: Image.Image) -> str:
    """A tiny visual fingerprint catches resized copies beyond byte equality."""
    pixels = list(image.convert('L').resize((9, 8)).getdata())
    value = 0
    for y in range(8):
        for x in range(8):
            value = (value << 1) | int(pixels[y * 9 + x] > pixels[y * 9 + x + 1])
    return f'{value:016x}'


def sheet(rows, title: str, name: str) -> None:
    """Create labelled pixel evidence; search metadata is never ground truth."""
    width, height, cols = 230, 220, 5
    canvas = Image.new('RGB', (width * cols, 36 + height * ((len(rows) + cols - 1) // cols)), 'white')
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 8), title, fill='black')
    for index, row in enumerate(rows):
        x, y = (index % cols) * width, 36 + (index // cols) * height
        with Image.open(ROOT / row['local_path']) as photo:
            thumb = ImageOps.contain(photo.convert('RGB'), (220, 172))
        canvas.paste(thumb, (x + (width - thumb.width) // 2, y))
        draw.text((x + 5, y + 175), row['id'], fill='black')
        draw.text((x + 5, y + 192), row.get('title', '')[:33].encode('ascii', 'replace').decode(), fill='black')
    target = OUT / 'contact-sheets' / f'{name}.jpg'
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, quality=88)


def collect_existing() -> list[dict]:
    """Reuse licensed, previously reviewed pixels but explicitly mark them old.

    Their new internal split checks policy generalisation within this collection;
    it is not an independent fresh benchmark because previous work saw them.
    """
    rows, counts, seen, hashes = [], Counter(), set(), set()
    items = [json.loads(line) for line in OLD_MANIFEST.read_text(encoding='utf-8').splitlines()]
    controls = {'food_processor', 'portable_heater', 'dehumidifier', 'shaver',
                'portable_ac', 'steam_cleaner', 'straightener', 'sandwich_press'}
    unrelated = {'chair', 'backpack', 'shoes', 'bottle', 'toy_figure', 'dishware_bowl'}
    # Stable hashing mixes the prior manifest order without consulting predictions.
    items.sort(key=lambda item: hashlib.sha256(str(item.get('openverse_id') or item.get('local_path')).encode()).hexdigest())
    for item in items:
        label = {'vaccum_cleaner': 'vacuum_cleaner'}.get(item['candidate_label'], item['candidate_label'])
        if label in ACTIVE[:11]:
            kind, maximum = 'supported', (28 if label in {'toaster', 'hair_dryer', 'air_fryer'} else 16)
        elif label in controls:
            kind, maximum = 'unsupported', 3
        elif label in unrelated:
            kind, maximum = 'unrelated', 3
        else:
            continue
        source = OLD / item['local_path']
        source_id = item.get('openverse_id') or item.get('source_asset_id') or item['local_path']
        group = item.get('split_group') or item.get('landing_url') or source_id
        if counts[label] >= maximum or group in seen or not source.is_file():
            continue
        actual_hash = digest(source)
        if actual_hash in hashes or item.get('license') not in {'by', 'by-sa', 'cc0', 'pdm'}:
            continue
        row_id = f'{label}-{counts[label] + 1:02d}'
        target = OUT / 'images' / label / f'{row_id}.jpg'
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        with Image.open(target) as photo:
            pixel_hash = dhash(photo)
        rows.append({'id': row_id, 'label': label, 'kind': kind, 'local_path': target.relative_to(ROOT).as_posix(),
                     'sha256': actual_hash, 'dhash': pixel_hash, 'source_group': group,
                     'source_asset_id': item.get('source_item_id') or source_id, 'source_dataset': item.get('source'),
                     'source_url': item.get('landing_url') or ('https://amazon-berkeley-objects.s3.amazonaws.com/index.html' if item.get('source') == 'amazon_berkeley_objects' else None),
                     'original_url': item.get('original_url') or item.get('url'),
                     'title': item.get('title'), 'creator': item.get('creator') or ('Amazon.com' if item.get('source') == 'amazon_berkeley_objects' else None),
                     'license': item.get('license'), 'license_url': item.get('license_url'),
                     'attribution': item.get('attribution'), 'reused_development': True,
                     'prior_review': item.get('review_source'), 'visual_review': 'pending',
                     'selection_uses_model_predictions': False})
        counts[label] += 1
        seen.add(group)
        hashes.add(actual_hash)
    return rows


def collect_new(label: str) -> list[dict]:
    """Fetch reusable photos from the public catalogue, preserving attribution.

    Downloads are bounded and remain local evaluation assets. Metadata filtering
    reduces irrelevant results; approval still requires seeing the actual image.
    """
    session = requests.Session()
    session.headers.update(HEADERS)
    rows, seen, creators, hashes = [], set(), Counter(), set()
    raw_results = []
    checkpoint = OUT / 'sources' / f'{label}.json'
    for query in NEW_QUERIES[label]:
        response = session.get(API, params={'q': query, 'page_size': 20, 'license': 'by,by-sa,cc0'}, timeout=30)
        if response.status_code != 200:
            raw_results.append({'query': query, 'error_status': response.status_code})
            write_json(checkpoint, raw_results)
            continue
        data = response.json()
        raw_results.append({'query': query, 'result_count': data.get('result_count'), 'results': data.get('results', [])})
        write_json(checkpoint, raw_results)
        for item in data.get('results', []):
            sid, creator = item['id'], item.get('creator') or ''
            title = item.get('title') or ''
            if sid in seen or creators[creator] >= 3:
                continue
            seen.add(sid)
            if item.get('license') not in {'by', 'by-sa', 'cc0'} or not item.get('license_url'):
                continue
            if any(word in title.lower() for word in ['diagram', 'icon', 'logo', 'banner', 'wallpaper', 'advertisement', 'motherboard', 'keyboard only']):
                continue
            try:
                # Openverse thumbnails are bounded photographs, not generated images.
                url = item.get('thumbnail') or item['url']
                reply = session.get(url, timeout=20)
                reply.raise_for_status()
                with Image.open(io.BytesIO(reply.content)) as source:
                    if source.width < 150 or source.height < 120:
                        continue
                    photo = ImageOps.exif_transpose(source).convert('RGB')
                    photo.thumbnail((1000, 1000))
                    pixel_hash = dhash(photo)
                    if any((int(pixel_hash, 16) ^ int(other, 16)).bit_count() <= 3 for other in hashes):
                        continue
                    row_id = f'{label}-new-{len(rows) + 1:02d}'
                    target = OUT / 'images' / label / f'{row_id}.jpg'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    photo.save(target, quality=94)
            except (requests.RequestException, OSError, ValueError):
                continue
            rows.append({'id': row_id, 'label': label, 'kind': 'supported', 'local_path': target.relative_to(ROOT).as_posix(),
                         'sha256': digest(target), 'dhash': pixel_hash,
                         'source_group': f"{item.get('source')}|{item.get('foreign_landing_url') or sid}",
                         'source_asset_id': sid, 'source_dataset': item.get('source'),
                         'source_url': item.get('foreign_landing_url'), 'original_url': item['url'],
                         'download_url': url, 'title': title, 'creator': creator,
                         'license': item['license'], 'license_url': item['license_url'],
                         'attribution': item.get('attribution'), 'reused_development': False,
                         'visual_review': 'pending', 'selection_uses_model_predictions': False})
            creators[creator] += 1
            hashes.add(pixel_hash)
            write_json(OUT / 'candidates' / f'{label}.json', rows)
            if len(rows) >= 22:
                break
        if len(rows) >= 22:
            break
    print(f'{label}: {len(rows)} new candidate photos', flush=True)
    return rows


def collect_commons(label: str, query: str) -> list[dict]:
    """Supplement sparse categories with per-file Commons licence evidence."""
    session = requests.Session()
    session.headers.update(HEADERS)
    response = session.get('https://commons.wikimedia.org/w/api.php', params={
        'action': 'query', 'generator': 'search', 'gsrsearch': query,
        'gsrnamespace': 6, 'gsrlimit': 16, 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata', 'iiurlwidth': 700, 'format': 'json', 'formatversion': 2}, timeout=30)
    response.raise_for_status()
    pages = response.json().get('query', {}).get('pages', [])
    write_json(OUT / 'sources' / f'{label}-commons.json', pages)
    rows = []
    for page in pages:
        info = (page.get('imageinfo') or [{}])[0]
        meta = info.get('extmetadata') or {}
        value = lambda name: meta.get(name, {}).get('value', '')
        licence, licence_url = value('LicenseShortName'), value('LicenseUrl')
        if not (licence.startswith('CC BY') or licence in {'CC0', 'Public domain'}):
            continue
        if info.get('url', '').lower().endswith(('.svg', '.pdf', '.webm', '.ogv')):
            continue
        url = info.get('thumburl') or info.get('url')
        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
            with Image.open(io.BytesIO(response.content)) as image:
                photo = ImageOps.exif_transpose(image).convert('RGB')
                photo.thumbnail((1000, 1000))
                row_id = f'{label}-commons-{len(rows)+1:02d}'
                target = OUT / 'images' / label / f'{row_id}.jpg'
                target.parent.mkdir(parents=True, exist_ok=True)
                photo.save(target, quality=94)
                pixel_hash = dhash(photo)
        except (requests.RequestException, OSError):
            continue
        rows.append({'id': row_id, 'label': label, 'kind': 'supported', 'local_path': target.relative_to(ROOT).as_posix(),
                     'sha256': digest(target), 'dhash': pixel_hash, 'source_group': f"commons-page-{page['pageid']}",
                     'source_asset_id': str(page['pageid']), 'source_dataset': 'Wikimedia Commons',
                     'source_url': info.get('descriptionurl'), 'original_url': info.get('url'), 'download_url': url,
                     'title': page['title'], 'creator': value('Artist'), 'license': licence,
                     'license_url': licence_url or 'https://creativecommons.org/publicdomain/mark/1.0/',
                     'attribution': value('Attribution') or value('Artist'), 'reused_development': False,
                     'visual_review': 'pending', 'selection_uses_model_predictions': False})
    write_json(OUT / 'candidates' / f'{label}-commons.json', rows)
    sheet(rows, f'{label} Commons supplements - pixel review', f'{label}-commons')
    print(f'{label} Commons: {len(rows)} candidates', flush=True)
    return rows


def collect() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    existing = collect_existing()
    write_json(OUT / 'candidates' / 'existing.json', existing)
    # Three concurrent source requests are enough; avoid hammering public APIs.
    with ThreadPoolExecutor(max_workers=3) as pool:
        new_batches = list(pool.map(collect_new, NEW_QUERIES))
    supplements = [collect_commons('washing_machine', 'front load washing machine filetype:bitmap'),
                   collect_commons('air_fryer', 'air fryer filetype:bitmap')]
    candidates = existing + [row for batch in new_batches + supplements for row in batch]
    write_json(OUT / 'candidates.json', candidates)
    groups = defaultdict(list)
    for row in candidates:
        groups[row['label']].append(row)
    for label, rows in groups.items():
        sheet(rows, f'{label} - visual audit before predictions', label)
    print(json.dumps({'candidates': len(candidates), 'labels': dict(Counter(row['label'] for row in candidates))}), flush=True)


def finalize() -> None:
    """Freeze manually checked rows and assign source-isolated internal splits.

    Rejections are kept in the audit ledger, not deleted. Holdout scores must stay
    unopened until the Explore policy is frozen. Old images are always labelled
    reused even when assigned the internal holdout partition.
    """
    candidates = json.loads((OUT / 'candidates.json').read_text(encoding='utf-8'))
    review = json.loads((OUT / 'visual-review.json').read_text(encoding='utf-8'))
    accepted, excluded, hashes, groups = [], [], set(), set()
    prior = [json.loads(line) for line in OLD_MANIFEST.read_text(encoding='utf-8').splitlines()]
    prior_ids = {str(row.get('openverse_id') or '') for row in prior}
    prior_urls = {str(row.get(key) or '').split('?')[0] for row in prior for key in ['original_url', 'landing_url', 'url']}
    for row in candidates:
        decision = review.get(row['id'])
        if not decision or decision['decision'] != 'accept':
            excluded.append({'id': row['id'], 'reason': (decision or {}).get('reason', 'not visually approved')})
            continue
        if row['sha256'] in hashes or row['source_group'] in groups:
            excluded.append({'id': row['id'], 'reason': 'duplicate pixels or source identity'})
            continue
        row['visual_review'] = {'status': 'approved', 'method': 'assistant contact-sheet pixel review; not independent human annotation', 'note': decision.get('reason'), 'date': '2026-10-10'}
        # A fresh download can still be an old source; do not relabel it unseen.
        if str(row.get('source_asset_id')) in prior_ids or str(row.get('original_url') or '').split('?')[0] in prior_urls:
            row['reused_development'] = True
        row['split'] = 'unassigned'
        row['slug'] = row['label'] if row['kind'] == 'supported' else None
        row['image_path'] = Path(row['local_path']).relative_to(OUT.relative_to(ROOT)).as_posix()
        accepted.append(row)
        hashes.add(row['sha256'])
        groups.add(row['source_group'])
        if decision.get('source_family_group'):
            # Product colour variants stay together even with distinct URLs/IDs.
            row['source_group'] = decision['source_family_group']
    # These are explicit rejection controls, never claimed as real test photos.
    for name, color in [('black', 0), ('gray', 128), ('white', 255), ('noise', None)]:
        path = OUT / 'images' / 'synthetic' / f'{name}.png'
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new('RGB', (384, 384), (color, color, color)) if color is not None else Image.frombytes('RGB', (384, 384), random.Random(20261010).randbytes(384 * 384 * 3))
        image.save(path)
        accepted.append({'id': f'synthetic-{name}', 'label': f'synthetic_{name}', 'slug': None,
                         'kind': 'synthetic', 'split': 'holdout', 'image_path': path.relative_to(OUT).as_posix(),
                         'local_path': path.relative_to(ROOT).as_posix(), 'sha256': digest(path),
                         'source_group': f'synthetic-{name}-20261010', 'reused_development': False,
                         'source_dataset': 'Deterministic rejection controls', 'license': 'project-authored',
                         'description': 'Non-photographic rejection control, not a real image or accuracy evidence.'})
    by_label = defaultdict(list)
    for row in accepted:
        if row['kind'] == 'synthetic':
            continue
        by_label[row['label']].append(row)
    # Deterministic grouped assignment is made before looking at Explore outputs.
    for label, rows in by_label.items():
        grouped = defaultdict(list)
        for row in rows:
            grouped[row['source_group']].append(row)
        ordered = sorted(grouped, key=lambda group: hashlib.sha256(group.encode()).hexdigest())
        target = max(1, len(rows) // 2)
        chosen, total = set(), 0
        for group in ordered:
            size = len(grouped[group])
            if total + size <= target:
                chosen.add(group)
                total += size
        for row in rows:
            row['split'] = 'holdout' if row['source_group'] in chosen else 'calibration'
    document = {'schema_version': 1, 'dataset_id': 'fixforward-explore-16-source-grouped-v1',
                'frozen_at_utc': datetime.now(timezone.utc).isoformat(), 'active_labels': ACTIVE,
                'purpose': 'Explore-only calibration and scoped evaluation; not raw weight training',
                'selection_uses_explore_model_predictions': False,
                'holdout_predictions_opened_before_policy_freeze': False,
                'limitation': 'Previously used appliance photos remain development evidence. New-category images are independent source-group holdouts, but this small convenience sample does not establish production accuracy.',
                'samples': accepted, 'excluded_rows': excluded}
    write_json(OUT / 'manifest.json', document)
    summary = Counter((row['label'], row['split']) for row in accepted)
    print(json.dumps({'accepted': len(accepted), 'splits': {f'{label}/{split}': count for (label, split), count in summary.items()}}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['collect', 'finalize'])
    args = parser.parse_args()
    collect() if args.stage == 'collect' else finalize()
