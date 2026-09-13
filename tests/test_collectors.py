import unittest, importlib.util, tempfile, os, json
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py')
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
customs=module('fetch-customs')
report=module('fetch-report')

class Collectors(unittest.TestCase):
    def test_rolling_13_month_report_accumulates_14_months(self):
        catalog=[{'id':'test','name':'test'}]
        months=[f'{2025+(7+i)//12:04d}-{(7+i)%12+1:02d}' for i in range(14)]
        old={'products':[{'id':'test','rows':[{'month':m,'exports':100} for m in months[:13]]}]}
        new={'products':[{'id':'test','rows':[{'month':m,'exports':200} for m in months[1:]]}]}
        rows=report.merge_products(catalog,[old,new])[0]['rows']
        self.assertEqual(len(rows),14)
        self.assertEqual(rows[0],{'month':'2025-08','exports':100})
        self.assertEqual(rows[1],{'month':'2025-09','exports':200})
        self.assertEqual(rows[-1]['month'],'2026-09')

    def test_customs_cumulative_period_and_unit(self):
        fields=''.join(f'<itemUsdAmt{i:02d}>123,456</itemUsdAmt{i:02d}>' for i in range(11))
        raw=f'<response><header><resultCode>00</resultCode></header><body><totalCount>1</totalCount><items><item><priodYear>2026</priodYear><priodMon>09</priodMon><priodDt>1~10</priodDt>{fields}</item></items></body></response>'
        rows=customs.parse(raw,'2026-09')
        self.assertEqual(rows[0]['window'],10)
        self.assertEqual(rows[0]['values']['itemUsdAmt01'],123456)
        with self.assertRaises(ValueError): customs.parse(raw,'2026-08')
        with self.assertRaises(ValueError): customs.parse(raw.replace('1~10','unknown'),'2026-09')
        with self.assertRaises(ValueError): customs.parse(raw.replace('<resultCode>00','<resultCode>03'),'2026-09')
        with self.assertRaises(ValueError): customs.parse(raw.replace('<totalCount>1','<totalCount>2'),'2026-09')

    def test_official_update_retains_older_rows_and_replaces_revisions(self):
        class Page:
            def extract_text(self): return '20대 품목별 수출 추이 백만달러\n전체 '+ ' '.join(f'{(7+i)%12+1}월' for i in range(13))
        class PDF:
            pages=[Page()]
            def __enter__(self): return self
            def __exit__(self,*args): pass
        cfg={'url':'https://www.korea.kr/test.pdf','pages':[1],'firstMonth':'2025-08','lastMonth':'2026-08'}
        with tempfile.TemporaryDirectory() as folder:
            cwd=os.getcwd()
            try:
                os.chdir(folder)
                for p in ['config','data','dist/data']: Path(p).mkdir(parents=True,exist_ok=True)
                Path('config/products.json').write_text('[{"id":"test","name":"test"}]')
                Path('data/history.json').write_text(json.dumps({'products':[{'id':'test','rows':[{'month':'2024-01','exports':5}]}]}))
                Path('dist/data/products.json').write_text(json.dumps({'products':[{'id':'test','rows':[{'month':'2025-08','exports':1}]}]}))
                with patch.object(report.pdfplumber,'open',return_value=PDF()),patch.object(report,'parse_report',return_value={'test':[{'month':'2025-08','exports':2}]}):
                    report.main(cfg,b'%PDF-test')
                rows=json.loads(Path('dist/data/products.json').read_text(encoding='utf-8'))['products'][0]['rows']
                self.assertEqual(rows,[{'month':'2024-01','exports':5},{'month':'2025-08','exports':2}])
                self.assertTrue(Path('data/reports/2026-08.json').exists())
            finally: os.chdir(cwd)

if __name__=='__main__': unittest.main()
