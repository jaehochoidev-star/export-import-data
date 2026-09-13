"""Discover the previous month report using only the government press release index."""
import re, json, io, importlib.util, time
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
from pathlib import Path
import pdfplumber

BASE='https://www.korea.kr'
class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.items=[]; self.current=None
    def handle_starttag(self, tag, attrs):
        if tag=='a': self.current=[dict(attrs).get('href',''),'']
    def handle_data(self, data):
        if self.current is not None: self.current[1]+=data
    def handle_endtag(self, tag):
        if tag=='a' and self.current is not None:
            self.items.append(self.current); self.current=None

def download(url):
    if urlparse(url).hostname!='www.korea.kr': raise ValueError('Government URLs only')
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45) as r:
                if urlparse(r.url).hostname!='www.korea.kr': raise ValueError('Unexpected redirect')
                data=r.read(15_000_001)
            if len(data)>15_000_000: raise ValueError('Response too large')
            return data
        except Exception:
            if attempt==2: raise
            time.sleep(2)

def links(raw):
    p=Links();p.feed(raw.decode('utf-8'));return p.items

def run():
    today=datetime.now(timezone(timedelta(hours=9))).date()
    last=today.replace(day=1)-timedelta(days=1)
    month=f'{last.year:04d}-{last.month:02d}'
    cfg=json.loads(Path('config/report.json').read_text(encoding='utf-8'))
    spec=importlib.util.spec_from_file_location('report',Path(__file__).with_name('fetch-report.py'))
    report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)
    if cfg['lastMonth']>month: raise ValueError('Configured report is in the future')
    # Re-fetch the current month too, so official revisions are reflected.
    query=urlencode({'srchWord':f'{last.year}년 {last.month}월 수출입','startDate':today.replace(day=1).isoformat(),'endDate':today.isoformat()})
    found=[]
    for href,title in links(download(BASE+'/briefing/pressReleaseList.do?'+query)):
        compact=re.sub(r'\s+','',title)
        if 'pressReleaseView.do?' in href and f'{last.year}년' in compact and f'{last.month}월' in compact and '수출입동향' in compact:
            news=re.search(r'newsId=(\d+)',href)
            if news: found.append(BASE+'/briefing/pressReleaseView.do?newsId='+news[1])
    # A cached, verified URL is safe only for the exact target month.
    if not found and cfg['lastMonth']==month: found=[cfg['policyUrl']]
    if not found: raise ValueError('Target monthly report not published/found: '+month)
    errors=[]
    for article in dict.fromkeys(found):
        for href,title in links(download(article)):
            if 'download.do?' not in href or '.pdf' not in title.lower() or '수출입' not in title: continue
            url=urljoin(BASE,unescape(href))
            try:
                pdf=download(url)
                with pdfplumber.open(io.BytesIO(pdf)) as doc:
                    texts=[p.extract_text() or '' for p in doc.pages]
                if not any(f'{last.year}년' in t.replace(' ','') and f'{last.month}월' in t.replace(' ','') for t in texts[:3]):
                    raise ValueError('PDF target month not found')
                page=next(i for i,t in enumerate(texts) if '20대 품목별 수출 추이' in t)
                dates=re.findall(r'20\d{2}[.-]\d{2}[.-]\d{2}',download(article).decode('utf-8'))
                next_cfg={'title':f'{last.year}년 {last.month}월 수출입동향','publishedAt':min((d.replace('.','-') for d in dates if d.replace('.','-').startswith(today.strftime('%Y-%m'))),default=today.replace(day=1).isoformat()),'firstMonth':f'{last.year-1:04d}-{last.month:02d}','lastMonth':month,'pages':[page+1,page+2],'url':url,'policyUrl':article.split('&')[0]}
                report.main(next_cfg,pdf);return
            except Exception as e: errors.append(str(e))
    raise ValueError('No valid official 20-product PDF: '+'; '.join(errors))
if __name__=='__main__': run()
