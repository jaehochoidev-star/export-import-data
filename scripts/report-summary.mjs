import {readFile,appendFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('dist/data/products.json','utf8'));
const text=`공식 자료: ${data.report.title} (${data.report.publishedAt})\n\n최신 13개월: 산업통상부 PDF 직접 추출. 이전 자료: 참고 사이트 공개 월별표 스냅샷.\n\nKOSIS 키 불필요. 새로운 월의 갱신은 config/report.json에 검증된 새 보도자료 URL·기간·쪽수를 등록한 뒤 재실행합니다.\n`;
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);else console.log(text);
