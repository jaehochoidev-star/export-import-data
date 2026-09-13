import {readFile,appendFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('dist/data/products.json','utf8'));
const text=`공식 자료: ${data.report.title} (${data.report.publishedAt})\n\n신규 자료: 산업통상부 PDF 직접 추출. 이전 보관 자료와 연결.\n\nKOSIS 키 불필요. 매월 2일 한국시간 10시 공식 보고서 자동 검색·누적 저장·배포. 관세청 API는 CUSTOMS_API_KEY 등록 시 2·12·22일 갱신.\n`;
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);else console.log(text);
