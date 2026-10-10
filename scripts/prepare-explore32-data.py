"""Prepare the separate 32-item Explore dataset without changing v1 evidence.

Public search metadata is only a candidate source. An assistant must inspect the
contact-sheet pixels and record decisions before freeze. No image-model outputs
are consulted. Previously opened v1/adult photos remain development evidence.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import shutil
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

SPEC = importlib.util.spec_from_file_location('explore_dataset_helpers', Path(__file__).with_name('prepare-explore-ai-data.py'))
HELPER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HELPER)
ROOT = HELPER.ROOT
OUT = ROOT / 'tmp/explore-ai32/dataset'
HELPER.OUT = OUT  # Reuse source readers, never write the version-one directory.
NEW = ['refrigerator','food_processor','sandwich_press','portable_heater','portable_ac',
       'dehumidifier','headphones','games_console','printer','steam_cleaner','clothes_dryer',
       'straightener','shaver','electric_toothbrush','cordless_drill','sewing_machine']
QUERIES = {
 'refrigerator': 'refrigerator kitchen filetype:bitmap',
 'food_processor': 'food processor filetype:bitmap',
 'sandwich_press': 'sandwich toaster filetype:bitmap',
 'portable_heater': 'electric portable heater filetype:bitmap',
 'portable_ac': 'portable air conditioner filetype:bitmap',
 'dehumidifier': 'dehumidifier filetype:bitmap',
 'headphones': 'headphones filetype:bitmap',
 'games_console': 'video game console filetype:bitmap',
 'printer': 'inkjet laser printer filetype:bitmap',
 'steam_cleaner': 'steam cleaner filetype:bitmap',
 'clothes_dryer': 'tumble clothes dryer filetype:bitmap',
 'straightener': 'hair straightener filetype:bitmap',
 'shaver': 'electric shaver filetype:bitmap',
 'electric_toothbrush': 'electric toothbrush filetype:bitmap',
 'cordless_drill': 'cordless drill filetype:bitmap',
 'sewing_machine': 'electric sewing machine filetype:bitmap',
}
# Additional searches are retained for provenance/reproduction, even when their
# results were all rejected. Search words are candidates, never ground truth.
SUPPLEMENT_QUERIES = {
 'printer-extra':'printer filetype:bitmap',
 'straightener-extra':'hair straightening iron filetype:bitmap',
 'sandwich_press-extra':'panini press filetype:bitmap',
 'headphones-extra':'over ear headphones filetype:bitmap',
 'sewing_machine-extra':'modern sewing machine filetype:bitmap',
 'electric_toothbrush-extra':'Sonicare toothbrush filetype:bitmap',
 'clothes_dryer-extra':'domestic tumble dryer filetype:bitmap',
 'clothes_dryer-samsung':'Samsung dryer filetype:bitmap',
 'computer_monitor':'computer monitor filetype:bitmap',
 'remote_control':'television remote control filetype:bitmap',
 'keyboard_or_mouse':'computer mouse filetype:bitmap',
}


def write(path, value):
    HELPER.write_json(path, value)


def copy_v1():
    """Preserve first16 partitions and identities, but mark every reused photo."""
    path = ROOT / 'tmp/explore-ai/dataset/manifest.json'
    frozen = json.loads(path.read_text(encoding='utf-8'))
    rows = []
    for original in frozen['samples']:
        if original['kind'] not in {'supported','unrelated','synthetic'}:
            continue
        row = dict(original)
        source = path.parent / row['image_path']
        target = OUT / 'images' / 'v1' / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        row.update(id='v1-' + row['id'], image_path=target.relative_to(OUT).as_posix(),
                   local_path=target.relative_to(ROOT).as_posix(), reused_development=True,
                   prior_manifest_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                   prior_partition=row['split'])
        rows.append(row)
    write(OUT / 'v1-reused.json', rows)
    return rows


def old_candidates():
    """Copy bounded old licensed candidates; old labels are not re-approval."""
    sources = [HELPER.OLD_MANIFEST,
               HELPER.OLD / 'tmp/appliance-model-v3-fresh-validation/positives/candidate-manifest.jsonl',
               HELPER.OLD / 'tmp/appliance-model-v3-fresh-validation/positives-resumed/candidate-manifest.jsonl']
    items = [json.loads(line) for path in sources if path.exists() for line in path.read_text(encoding='utf-8').splitlines()]
    items.sort(key=lambda item: hashlib.sha256(str(item.get('local_path')).encode()).hexdigest())
    rows, seen, counts = [], set(), Counter()
    for item in items:
        label = item.get('candidate_label')
        if label not in NEW or counts[label] >= 24:
            continue
        source = HELPER.OLD / item['local_path']
        if not source.is_file():
            continue
        license = item.get('license','')
        if not (license in {'by','by-sa','cc0','pdm','Public domain'} or license.startswith('CC BY')) or not item.get('license_url'):
            continue
        sha = HELPER.digest(source)
        if sha in seen:
            continue
        seen.add(sha)
        counts[label] += 1
        row_id = f'{label}-old-{counts[label]:02d}'
        target = OUT / 'images' / label / f'{row_id}.jpg'
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        abo = item.get('source') == 'amazon_berkeley_objects'
        with HELPER.Image.open(target) as image:
            dhash = HELPER.dhash(image)
        rows.append({'id':row_id,'label':label,'slug':label,'kind':'supported',
                     'image_path':target.relative_to(OUT).as_posix(),'local_path':target.relative_to(ROOT).as_posix(),
                     'sha256':sha,'dhash':dhash,'source_group':item.get('source_family_key') or item.get('split_group') or item.get('landing_url') or item.get('source_asset_id') or sha,
                     'source_asset_id':item.get('openverse_id') or item.get('source_asset_id') or item.get('source_item_id'),
                     'source_dataset':item.get('source_dataset') or item.get('source'),
                     'source_url':item.get('landing_url') or ('https://amazon-berkeley-objects.s3.amazonaws.com/index.html' if abo else None),
                     'original_url':item.get('original_url') or item.get('url'),
                     'title':item.get('title'),'creator':item.get('creator') or ('Amazon.com' if abo else None),
                     'license':license,'license_url':item['license_url'],'attribution':item.get('attribution'),
                     'reused_development':True,'visual_review':'pending','selection_uses_model_predictions':False})
    write(OUT / 'candidates/old.json', rows)
    return rows


def collect():
    copy_v1()
    old = old_candidates()
    with ThreadPoolExecutor(max_workers=3) as pool:
        collected = list(pool.map(lambda label: HELPER.collect_commons(label, QUERIES[label]), NEW))
    rows = old + [row for batch in collected for row in batch]
    write(OUT / 'candidates.json', rows)
    for label in NEW:
        HELPER.sheet([row for row in old if row['label'] == label], label + ' old candidates', label + '-old')
    print('Candidates', len(rows), flush=True)


def collect_supplements():
    """Recreate public candidate searches, never overwrite a frozen manifest."""
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda pair: HELPER.collect_commons(*pair), SUPPLEMENT_QUERIES.items()))


def source_identity(url):
    """Compare image URLs without attribution tracking queries or URL escaping."""
    if not url:
        return None
    parsed = urlsplit(url)
    return unquote(parsed.netloc.lower() + parsed.path)


def freeze():
    """Freeze reviewed source families before any 32-class predictions are seen."""
    if (OUT / 'manifest.json').exists():
        raise SystemExit('Frozen manifest already exists; use a new dataset version, never overwrite evidence.')
    candidates = json.loads((OUT / 'candidates.json').read_text(encoding='utf-8'))
    review = json.loads((OUT / 'visual-review.json').read_text(encoding='utf-8'))
    rows = json.loads((OUT / 'v1-reused.json').read_text(encoding='utf-8'))
    hashes = {row['sha256'] for row in rows}
    ids = {row['id'] for row in rows}
    # A download is not new evidence if the source was already in adult/v1 work.
    prior_paths = [HELPER.OLD_MANIFEST,
                   HELPER.OLD / 'tmp/appliance-model-v3-fresh-validation/positives/candidate-manifest.jsonl',
                   HELPER.OLD / 'tmp/appliance-model-v3-fresh-validation/positives-resumed/candidate-manifest.jsonl']
    prior = [json.loads(line) for path in prior_paths if path.exists()
             for line in path.read_text(encoding='utf-8').splitlines()]
    prior_urls = {source_identity(item.get(key)) for item in prior
                  for key in ['original_url','url'] if item.get(key)}
    excluded = []
    for candidate in candidates:
        decision = review.get(candidate['id'],{})
        if decision.get('decision') != 'accept':
            excluded.append({'id':candidate['id'],'reason':decision.get('reason','Not approved by assistant pixel review')})
            continue
        row = dict(candidate)
        assert row['id'] not in ids, 'Duplicate sample ID'
        if row['sha256'] in hashes:
            excluded.append({'id':row['id'],'reason':'duplicate image bytes'})
            continue
        # Electronic controls keep null expected labels: they must be rejected.
        kind = row.get('kind', 'supported')
        row.update(slug=row['label'] if kind == 'supported' else None,kind=kind,split='unassigned',
                   image_path=Path(row['local_path']).relative_to(OUT.relative_to(ROOT)).as_posix(),
                   visual_review={'method':'assistant contact-sheet pixel review; not independent human annotation',
                                  'status':'approved','note':decision.get('reason'),'date':'2026-10-10'})
        if decision.get('source_family_group'):
            row['source_group'] = decision['source_family_group']
        if source_identity(row.get('original_url')) in prior_urls:
            row['reused_development'] = True
        ids.add(row['id'])
        hashes.add(row['sha256'])
        rows.append(row)
    # New classes and negative classes are balanced independently. Retain every
    # original v1 partition; an old holdout can never become a fresh holdout.
    unassigned_labels = {row['label'] for row in rows if row['split'] == 'unassigned'}
    for label in sorted(unassigned_labels):
        matching = [row for row in rows if row.get('label') == label and row['split'] == 'unassigned']
        groups = defaultdict(list)
        for row in matching:
            groups[row['source_group']].append(row)
        ordered = sorted(groups, key=lambda key:hashlib.sha256(key.encode()).hexdigest())
        chosen, total = set(), 0
        for group in ordered:
            if total + len(groups[group]) <= len(matching)//2:
                chosen.add(group); total += len(groups[group])
        for row in matching:
            row['split'] = 'holdout' if row['source_group'] in chosen else 'calibration'
    groups, source_splits = {}, {}
    for row in rows:
        assert row['split'] in {'calibration','holdout'}, 'Unassigned split'
        assert row['kind'] in {'supported','unrelated','synthetic'}, 'Unexpected sample kind'
        assert (row['slug'] in HELPER.ACTIVE + NEW) if row['kind'] == 'supported' else row['slug'] is None
        assert row['source_group'] not in groups or groups[row['source_group']] == row['split'], 'Cross-split source family overlap'
        groups[row['source_group']] = row['split']
        assert HELPER.digest(OUT / row['image_path']) == row['sha256'], row['id']
        if row.get('original_url'):
            identity = source_identity(row['original_url'])
            assert identity not in source_splits or source_splits[identity] == row['split'], 'Cross-split original-image overlap'
            source_splits[identity] = row['split']
        if row['kind'] != 'synthetic':
            assert row.get('source_url') and row.get('license') and row.get('license_url'), 'Missing source/licence evidence'
    assert len(hashes) == len(rows), 'Duplicate image bytes'
    for label in HELPER.ACTIVE + NEW:
        assert {row['split'] for row in rows if row.get('slug') == label} == {'calibration','holdout'}, 'Every supported class needs both partitions'
    manifest = {'schema_version':2,'dataset_id':'fixforward-explore-32-source-grouped-v2',
                'frozen_at_utc':datetime.now(timezone.utc).isoformat(),'active_labels':HELPER.ACTIVE + NEW,
                'purpose':'Explore-only 32-class calibration and limited evaluation; not raw weight training',
                'selection_uses_explore32_predictions':False,'holdout_predictions_opened_before_policy_freeze':False,
                'limitations':['All prior16 photos were already opened in v1 development; they are not fresh independent validation.',
                               'Small convenience sample with assistant visual review, not independent human ground truth or production accuracy.',
                               'Sparse classes deliberately retain fewer than eight defensible photos rather than padding with duplicates or incorrect labels.',
                               'Food processor colour variants share one source family and stay in the same partition.',
                               'Console photos share an isolated-background photographer style; clothes dryers include commercial machines.'],
                'samples':rows,'excluded_rows':excluded}
    write(OUT / 'manifest.json',manifest)
    print(json.dumps({'total':len(rows),'counts':dict(Counter(row.get('slug') or row['kind'] for row in rows)),
                      'sha256':HELPER.digest(OUT/'manifest.json')},indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage',choices=['collect','supplements','freeze'])
    args=parser.parse_args()
    # Image bytes are evidence too: forbid re-collecting over a frozen dataset.
    if (OUT / 'manifest.json').exists():
        raise SystemExit('Dataset v2 is frozen. Create a new output version before collecting or changing evidence.')
    {'collect':collect,'supplements':collect_supplements,'freeze':freeze}[args.stage]()
