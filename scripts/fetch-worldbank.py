"""Accumulate official Pink Sheet silver observations, preserving earlier months."""
import io, json, re, math, urllib.request
from pathlib import Path
from datetime import datetime, timezone
import openpyxl

PAGE='https://www.worldbank.org/en/research/commodity-markets'
def extract(content):
    book=openpyxl.load_workbook(io.BytesIO(content),read_only=True,data_only=True)
    rows=list(book['Monthly Prices'].values)
    headers=[(i,row.index('Silver')) for i,row in enumerate(rows[:15]) if row.count('Silver')==1]
    if len(headers)!=1: raise ValueError('Pink Sheet Silver column missing or ambiguous')
    header,col=headers[0]
    if rows[header+1][col]!='($/troy oz)': raise ValueError('Silver units changed')
    result=[];seen=set()
    for row in rows[header+2:]:
        month=str(row[0]);match=re.fullmatch(r'(\d{4})M(\d{2})',month)
        if not match: continue
        year,monthnum=map(int,match.groups())
        date=datetime(year,monthnum,1).strftime('%Y-%m-%d')
        if year<2000: continue
        if date in seen: raise ValueError('Duplicate silver month')
        seen.add(date);value=row[col]
        if value is None or value in ('..','...','…','��'): value=None
        elif isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<=0: raise ValueError('Invalid silver price')
        result.append({'date':date,'value':value})
    book.close()
    if len(result)<200: raise ValueError('Incomplete silver history')
    return sorted(result,key=lambda r:r['date'])

def main():
    url='https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx'
    with urllib.request.urlopen(url,timeout=60) as response: content=response.read()
    incoming=extract(content);path=Path('data/worldbank.json')
    old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    merged={r['date']:r for r in old.get('series',[{'rows':[]}])[0]['rows']}
    merged.update({r['date']:r for r in incoming})
    series=[{'id':'WB_SILVER','name':'은','group':'metals','frequency':'M','unit':'달러/트로이온스','provider':'세계은행 Pink Sheet','sourceUrl':PAGE,'rows':sorted(merged.values(),key=lambda r:r['date'])}]
    changed=series!=old.get('series')
    data={'version':1,'status':'live','updatedAt':datetime.now(timezone.utc).isoformat() if changed else old['updatedAt'],'workbookUrl':url,'series':series}
    text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    for target in [path,Path('dist/data/worldbank.json')]:
        target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_suffix('.tmp');temp.write_text(text,encoding='utf-8');temp.replace(target)
    if changed:
        raw=Path('data/worldbank/raw');raw.mkdir(parents=True,exist_ok=True)
        (raw/'pink-sheet-monthly.xlsx').write_bytes(content)
    print(f"World Bank Silver: {series[0]['rows'][0]['date']} to {series[0]['rows'][-1]['date']}; changed={changed}")

if __name__=='__main__': main()
