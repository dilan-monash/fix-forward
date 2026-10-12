"""Reconcile two independent image reviews before running any photo predictions.

Only exact agreement is retained. Disagreement becomes an uncertain exclusion;
the release class partition is applied afterward, never shown to the reviewers.
The strict assembler verifies this document against both original reviews.
"""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
import hashlib
import importlib.util
import json
import sys

ROOT=Path(__file__).resolve().parents[2]
BASE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v3_assembler',ROOT/'scripts/assemble-appliance-siglip-candidate-v3-test.py')
assembly=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=assembly
spec.loader.exec_module(assembly)

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def declaration(path, data, independent=False):
    result={'path':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frozen_at_utc':data['frozen_at_utc']}
    if independent:
        result.update(audit_id=data['audit_id'],auditor_id=data['auditor_id'])
    else:
        result['manifest_id']=data['manifest_id']
    return result

sources={
    'positives':BASE/'review-positives-final/positives-source-manifest.json',
    'ood':BASE/'review-ood-final/ood-source-manifest.json',
}
manifests={role:read(path) for role,path in sources.items()}
audit_paths=[BASE/'independent-audit-a.json',BASE/'independent-audit-b.json']
audits=[read(path) for path in audit_paths]
maps=[{r['row_key']:r for r in audit['rows']} for audit in audits]
decisions=[]
for role,manifest in manifests.items():
    for source in manifest['rows']:
        key=f"{role}:{source['row_id']}"
        pair=[assembly.visual_decision(mapping[key],key) for mapping in maps]
        if pair[0]==pair[1]:
            assignment,label,group=pair[0]
            status='agreed'
            if assignment=='operational_positive':
                assignment='eligible_operational_positive' if label in assembly.ENABLED_CLASSES else 'manual_only_operational_positive'
        else:
            assignment,label,group,status='exclude_uncertain',None,None,'resolved'
        decisions.append({'row_key':key,'source_role':role,'source_row_id':source['row_id'],
                          'downloaded_jpeg':source['downloaded_jpeg'],'sha256':source['sha256'],
                          'final_assignment':assignment,'final_class':label,
                          'true_ood_source_group':group,'reconciliation_status':status})
assignments=Counter(r['final_assignment'] for r in decisions)
classes=Counter(r['final_class'] for r in decisions if r['final_class'])
groups=Counter(r['true_ood_source_group'] for r in decisions if r['true_ood_source_group'])
summary={'total_rows':len(decisions),
         'final_assignment_counts':{name:assignments[name] for name in sorted(assembly.ASSIGNMENTS)},
         'final_class_counts':{name:classes[name] for name in (*assembly.ENABLED_CLASSES,*assembly.MANUAL_ONLY_CLASSES)},
         'true_ood_by_group':dict(sorted(groups.items()))}
result={'schema_version':1,'audit_id':'candidate-v3-fresh-reconciled-blind-review',
        'audit_type':'prediction_blind_two_auditor_reconciliation',
        'frozen_at_utc':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
        'inputs':{'source_manifests':{role:declaration(path,manifests[role]) for role,path in sources.items()},
                  'independent_audits':[declaration(path,audit,True) for path,audit in zip(audit_paths,audits)]},
        'blindness_attestations':{'auditors_independent_before_reconciliation':True,
                                 'model_outputs_opened':False,'prediction_scores_opened':False,
                                 'policy_gate_or_thresholds_opened_by_visual_auditors':False,
                                 'selection_used_model_predictions':False},
        'rows':decisions,'summary':summary}
with (BASE/'combined-reconciled-blind-audit.json').open('x',encoding='utf-8') as handle:
    json.dump(result,handle,indent=2)
    handle.write('\n')
print(json.dumps(summary,indent=2))
