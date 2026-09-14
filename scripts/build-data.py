"""Build the public dataset from the cumulative repository archive, without network."""
import json
from pathlib import Path

def main():
    source=Path('data/ministry.json')
    data=json.loads(source.read_text(encoding='utf-8'))
    if data.get('mode')!='live' or len(data.get('products',[]))!=20:
        raise ValueError('Invalid cumulative repository dataset')
    target=Path('dist/data/products.json');target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Built dashboard data from cumulative repository archive')
    kosis=Path('data/kosis.json')
    if kosis.exists():
        indices=json.loads(kosis.read_text(encoding='utf-8'))
        if indices.get('status')!='live' or len(indices.get('series',[]))!=17:
            raise ValueError('Invalid KOSIS cumulative archive')
        Path('dist/data/kosis.json').write_text(json.dumps(indices,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Built KOSIS indices from cumulative repository archive')
    fred=Path('data/fred.json')
    if fred.exists():
        prices=json.loads(fred.read_text(encoding='utf-8'))
        if prices.get('status')!='live' or len(prices.get('series',[]))!=15:
            raise ValueError('Invalid FRED cumulative archive')
        Path('dist/data/fred.json').write_text(json.dumps(prices,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('Built FRED data from cumulative repository archive')

    worldbank=Path('data/worldbank.json')
    if worldbank.exists():
        Path('dist/data/worldbank.json').write_bytes(worldbank.read_bytes())

if __name__=='__main__': main()
