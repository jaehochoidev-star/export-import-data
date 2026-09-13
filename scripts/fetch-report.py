"""Read the specified ministry monthly export report. Fail closed on layout changes."""
import json, re, sys, hashlib, urllib.request, io
from pathlib import Path
from datetime import datetime, timezone
import pdfplumber

def merge_products(catalog, sources):
    merged={p['id']:{} for p in catalog}
    for source in sources:
        for product in source['products']:
            if product['id'] not in merged: raise ValueError('Unknown archived product')
            for row in product['rows']:
                merged[product['id']][row['month']]=row
    return [{**p,'rows':sorted(merged[p['id']].values(),key=lambda r:r['month'])} for p in catalog]

def parse_report(text, months, names):
    text = text.split('③')[0]
    text = '\n'.join(line for line in text.splitlines() if not any(word in line for word in ['품목명','전체','백만달러','년','수출 추이']))
    pattern = re.compile(r'^(?:[가-힣]+\s+)?(?:\d[\d,]*\s+){13}\d[\d,]*\s*$', re.M)
    hits = list(pattern.finditer(text))
    result = {}
    for i,hit in enumerate(hits):
        segment=text[hit.start():hits[i+1].start() if i+1<len(hits) else len(text)]
        amounts=re.findall(r'\d[\d,]*',hit.group())
        rates=re.findall(r'\(([△\-]?\d+(?:\.\d+)?)\)',segment)
        label=re.sub(r'[^가-힣]','',re.sub(r'\([^)]*\)','',segment))
        if label not in names: raise ValueError('Unknown report label: '+label)
        if len(amounts)!=14 or len(rates)!=14: raise ValueError('Expected annual total plus 13 months')
        if label in result: raise ValueError('Duplicate product: '+label)
        result[label]=[{'month':m,'exports':int(a.replace(',',''))/100,'reportedYoy':float(y.replace('△','-')),'sourceId':'ministry-report'} for m,a,y in zip(months,amounts[1:],rates[1:])]
    if set(result)!=set(names): raise ValueError('Report does not contain exactly the expected 20 products')
    return result

def main(cfg=None, pdf_bytes=None):
    cfg=cfg or json.loads(Path('config/report.json').read_text(encoding='utf-8-sig'))
    from urllib.parse import urlparse
    if urlparse(cfg['url']).hostname not in ['www.korea.kr','www.motir.go.kr']: raise ValueError('Official sources only')
    if pdf_bytes is not None:
        pdf=pdf_bytes
    elif len(sys.argv)>1:
        pdf=Path(sys.argv[1]).read_bytes()
    else:
        with urllib.request.urlopen(cfg['url'],timeout=90) as response: pdf=response.read(15_000_001)
    if len(pdf)>15_000_000 or not pdf.startswith(b'%PDF'): raise ValueError('Not a supported PDF')
    with pdfplumber.open(io.BytesIO(pdf)) as doc:
        text='\n'.join(doc.pages[p-1].extract_text() or '' for p in cfg['pages'])
    if '20대 품목별 수출 추이' not in text or '백만달러' not in text: raise ValueError('Wrong report section or unit')
    year,month=map(int,cfg['firstMonth'].split('-'))
    months=[f'{(year*12+month-1+i)//12:04d}-{(year*12+month-1+i)%12+1:02d}' for i in range(13)]
    if months[-1]!=cfg['lastMonth']: raise ValueError('Expected exactly 13 calendar months')
    # Guard against a changed month header in a new PDF.
    for line in text.splitlines():
        if '전체' in line and len(re.findall(r'\d+월',line))==13:
            if list(map(int,re.findall(r'(\d+)월',line)))!=[int(m[-2:]) for m in months]: raise ValueError('Month header mismatch')
            break
    else: raise ValueError('Month header missing')
    catalog=json.loads(Path('config/products.json').read_text(encoding='utf-8'))
    names={p['name'] if p['name']!='철강제품' else '철강':p['id'] for p in catalog}
    parsed=parse_report(text,months,names)
    previous_path=Path('data/ministry.json')
    if not previous_path.exists(): previous_path=Path('dist/data/products.json')
    previous=json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {'products':[]}
    history=json.loads(Path("data/history.json").read_text(encoding="utf-8"))
    if previous.get('report',{}).get('lastMonth','')>cfg['lastMonth']: raise ValueError('Cannot replace a newer report with an older report')
    archives=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(Path('data/reports').glob('*.json'))]
    current={'products':[{**p,'rows':parsed['철강' if p['name']=='철강제품' else p['name']]} for p in catalog]}
    products=merge_products(catalog,[history,previous,*archives,current])
    output={'mode':'live','unit':'억 달러','source':'ministry-report','updatedAt':datetime.now(timezone.utc).isoformat(),'report':{**cfg,'sha256':hashlib.sha256(pdf).hexdigest()},'products':products}
    if all(output.get(k)==previous.get(k) for k in ['report','products','source']):
        output['updatedAt']=previous['updatedAt']
    archive=Path('data/reports'); archive.mkdir(parents=True,exist_ok=True)
    snapshot={'report':output['report'],'products':[{**p,'rows':parsed['철강' if p['name']=='철강제품' else p['name']]} for p in catalog]}
    (archive/(cfg['lastMonth']+'.json')).write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    Path('config/report.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    target=Path('dist/data/products.json'); temp=target.with_suffix('.json.tmp')
    target.parent.mkdir(parents=True,exist_ok=True)
    temp.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(target)
    canonical=Path('data/ministry.json');temp=canonical.with_suffix('.json.tmp')
    temp.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(canonical)
    print(f"Validated {len(products)} products; official report through {cfg['lastMonth']}")
if __name__=='__main__': main()
