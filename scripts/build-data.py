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

if __name__=='__main__': main()
