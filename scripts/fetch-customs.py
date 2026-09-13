"""Collect official cumulative ten-day export data; credentials never enter output."""
import os, json, re, calendar, hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode, unquote
from urllib.request import urlopen
import xml.etree.ElementTree as ET

ENDPOINT='https://apis.data.go.kr/1220000/prlstMmUtPrviExpAcrs/getPrlstMmUtPrviExpAcrs'
NAMES=['전체','반도체','철강제품','승용차','석유제품','무선통신기기','선박','자동차부품','컴퓨터주변기기','정밀기기','가전제품']
PRODUCTS=[{'id':f'itemUsdAmt{i:02d}','name':name} for i,name in enumerate(NAMES)]

def parse(raw, expected_month):
    doc=ET.fromstring(raw)
    for el in doc.iter(): el.tag=el.tag.split('}')[-1]
    code=doc.findtext('.//resultCode')
    if code not in ('00','000','0'): raise ValueError('Customs API did not return success')
    rows=[]
    for item in doc.findall('.//item'):
        year=re.sub(r'\D','',item.findtext('priodYear',''))
        mon=re.sub(r'\D','',item.findtext('priodMon',''))
        if len(mon)==6: year,mon=mon[:4],mon[4:]
        month=f'{int(year):04d}-{int(mon):02d}'
        if month!=expected_month: raise ValueError('Unexpected response month')
        day_text=item.findtext('priodDt','').strip()
        days=re.findall(r'\d+',day_text)
        day=int(days[-1]) if days else 31 if '말' in day_text else 0
        if day>100: day=day%100
        end=calendar.monthrange(int(year),int(mon))[1]
        window=day if day in (10,20) else 30 if day in (end,30,31) else None
        if window is None: raise ValueError('Unknown cumulative period')
        values={}
        for p in PRODUCTS:
            text=item.findtext(p['id'])
            if text is None or not re.fullmatch(r'[\d,]+(?:\.\d+)?',text.strip()): raise ValueError('Missing or invalid amount')
            values[p['id']]=float(text.replace(',',''))
        rows.append({'month':month,'window':window,'values':values})
    count=doc.findtext('.//totalCount')
    if count is not None and int(count)!=len(rows): raise ValueError('Truncated response')
    if len({r['window'] for r in rows})!=len(rows): raise ValueError('Duplicate period')
    return rows

def main():
    key=os.environ.get('CUSTOMS_API_KEY','').strip()
    if not key: raise ValueError('CUSTOMS_API_KEY is required')
    target=Path('dist/data/customs.json')
    previous=json.loads(target.read_text(encoding='utf-8'))
    today=datetime.now(timezone(timedelta(hours=9)))
    end=today.year*12+today.month-1
    # Refresh the whole stored range to reflect corrections; first run starts 2024-01.
    start=min([2024*12]+[int(r['month'][:4])*12+int(r['month'][5:])-1 for r in previous['rows']])
    collected=[]; hashes={}
    for serial in range(start,end+1):
        year,month=divmod(serial,12);month+=1
        stamp=f'{year:04d}{month:02d}'
        query=urlencode({'serviceKey':unquote(key),'strtYymm':stamp,'endYymm':stamp})
        try:
            with urlopen(ENDPOINT+'?'+query,timeout=60) as response: raw=response.read(5_000_001)
            if len(raw)>5_000_000: raise ValueError('Response too large')
            rows=parse(raw,f'{year:04d}-{month:02d}')
        except Exception:
            raise RuntimeError(f'Customs collection failed for {stamp}; check API approval and response schema') from None
        if not rows and serial<end: raise ValueError('Historical month unexpectedly empty')
        if serial<end and {r['window'] for r in rows}!={10,20,30}: raise ValueError('Historical month incomplete')
        hashes[stamp]=hashlib.sha256(raw).hexdigest();collected.extend(rows)
    if not collected: raise ValueError('Empty dataset')
    old={(r['month'],r['window']) for r in previous['rows']}
    if not old.issubset({(r['month'],r['window']) for r in collected}): raise ValueError('Previously collected periods disappeared')
    collected.sort(key=lambda r:(r['month'],r['window']))
    output={'status':'live','unit':'천 달러','sourceUrl':'https://www.data.go.kr/data/15157908/openapi.do','updatedAt':today.isoformat(),'products':PRODUCTS,'rows':collected}
    if previous.get('rows')==collected: output['updatedAt']=previous['updatedAt']
    snapshot=Path('data/customs');snapshot.mkdir(parents=True,exist_ok=True)
    (snapshot/(today.date().isoformat()+'.json')).write_text(json.dumps({**output,'responseHashes':hashes},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temp=target.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temp.replace(target)
    print(f'Validated {len(collected)} cumulative periods from official Customs API')

if __name__=='__main__': main()
