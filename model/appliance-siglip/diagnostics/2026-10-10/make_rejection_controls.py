"""Create reproducible non-appliance pixels to probe false suggestions.

These are synthetic regression controls, never evidence about household-photo
accuracy. No real photo or held-out cohort is opened by this script.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import random
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2]
out = root/'tmp/appliance-model-v3-fresh-validation/synthetic-controls'
out.mkdir(exist_ok=False)
random_source = random.Random(20261010)
images = {'black':Image.new('RGB',(256,256),'black'),
          'white':Image.new('RGB',(256,256),'white'),
          'grey':Image.new('RGB',(256,256),(127,127,127))}
images['rgb-noise'] = Image.frombytes('RGB',(256,256),random_source.randbytes(256*256*3))
images['grey-noise'] = Image.frombytes('L',(256,256),random_source.randbytes(256*256)).convert('RGB')
for name, size in [('fine-checkerboard',4),('coarse-checkerboard',32)]:
    image=Image.new('RGB',(256,256))
    pixels=image.load()
    for y in range(256):
        for x in range(256):
            level=255 if (x//size+y//size)%2 else 0
            pixels[x,y]=(level,level,level)
    images[name]=image
card=Image.new('RGB',(256,256),'white')
ImageDraw.Draw(card).text((25,100),'No appliance in this image',fill='black')
images['text-only']=card
rows=[]
for name,image in images.items():
    file=out/f'{name}.png'
    image.save(file)
    rows.append({'image_id':f'synthetic:{name}', 'downloaded_jpeg':file.relative_to(root).as_posix(),
                 'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
stamp=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
manifest={'frozen_at_utc':stamp,'scope':'synthetic non-appliance regression controls','samples':rows}
audit={'frozen_at_utc':stamp,'ground_truth_basis':'Generated pixels contain no appliance; not a photo audit.',
       'audited_operational_positive_ids':{},'audited_true_ood_ids':[r['image_id'] for r in rows],
       'ood_group_by_id':{r['image_id']:'synthetic_pattern' for r in rows}}
for name,value in [('manifest.json',manifest),('audit.json',audit)]:
    (out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
print(f'Created {len(rows)} synthetic regression controls.')
