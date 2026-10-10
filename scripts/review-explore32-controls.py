"""Record the assistant's pixel review of electronic rejection controls.

These IDs were selected from viewed contact sheets without model predictions.
They are negatives, not additional supported classes or extra training claims.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dataset = root / 'tmp/explore-ai32/dataset'
selected = {
    'computer_monitor': [3, 5, 8],
    'remote_control': [1, 2, 7, 16],
    'keyboard_or_mouse': [4, 5, 7, 10],
}
accepted, review = [], {}
for label, numbers in selected.items():
    rows = json.loads((dataset / f'candidates/{label}-commons.json').read_text(encoding='utf-8'))
    keep = {f'{label}-commons-{n:02d}' for n in numbers}
    for row in rows:
        chosen = row['id'] in keep
        reason = ('Visible whole out-of-scope electronic item, independently pictured source family.' if chosen
                  else 'Excluded: extra scene devices, artwork/screen-only view, duplicate family, or surplus candidate.')
        if row['id'] == 'computer_monitor-commons-05':
            reason = 'Real broken CRT monitor, retained as a difficult out-of-scope negative; not a safety assessment.'
        review[row['id']] = {'decision': 'accept' if chosen else 'exclude', 'reason': reason,
                             'method': 'assistant contact-sheet pixel inspection; not independent human annotation'}
        if chosen:
            assert row.get('license_url') and row.get('source_url')
            row.update(kind='unrelated', slug=None, visual_review=review[row['id']])
            accepted.append(row)
(dataset / 'candidates/electronic-controls-root.json').write_text(json.dumps(accepted, indent=2) + '\n', encoding='utf-8')
(dataset / 'electronic-controls-root-review.json').write_text(json.dumps(review, indent=2) + '\n', encoding='utf-8')
print(f'Recorded {len(accepted)} reviewed electronic negatives; no scores were consulted.')
