# 한국 수출 통계 대시보드

공개 주소: https://jaehochoidev-star.github.io/export-import-data/

## 화면

- 산업통상부: 20대 품목의 월별 수출액·12M MA·YoY와 8개 요약 지표. 기존 보관 자료와 공식 PDF 수치를 연결합니다.
- 관세청: 주요 10대 품목 및 전체 수출의 1~10일·1~20일·월 전체 누적 수출액과 전년 동일 기간 대비. API 인증 전에는 연결 준비 상태를 표시합니다.
- KOSIS: 향후 통계표 추가를 위한 탭입니다. 현재 미연결입니다.

산업통상부와 관세청은 품목 분류가 다르며 금액을 서로 합산하지 않습니다. 비교에 필요한 월이 없으면 지표를 비워 둡니다.

## 저장하는 자료

- `data/history.json`: 2025년 7월 이전의 기존 보관 수치. 추가 수집하지 않는 초기 이력이며 원문 PDF 대조는 미완료입니다.
- `data/reports/YYYY-MM.json`: 각 월 산업통상부 공식 보고서에서 추출한 수치와 PDF 해시. 같은 보고서의 수정치는 Git 변경 이력에 남습니다.
- `dist/data/products.json`: 과거 이력과 새 공식 자료를 합친 전체 월별 데이터. 겹치는 월은 새 공식 수치를 우선합니다.
- `data/customs/YYYY-MM-DD.json`: 관세청 수집 시점별 수치와 응답 해시. 키는 저장하지 않습니다.
- `dist/data/customs.json`: 관세청 최신 누적 이력.

공식 공표 YoY가 있으면 우선 사용합니다. 상태 분류는 자체 기준이며 화면에서 계산 방법을 확인할 수 있습니다. 보관 자료는 공식 PDF에서 직접 추출한 것으로 표시하지 않습니다.

## 정기 갱신과 배포

GitHub Actions `Publish dashboard`:

- 매월 2일 10:00 한국시간: 전월 산업통상부 보고서를 정부 정책브리핑에서 검색 → PDF의 20대 품목 표 확인 → 기존 데이터와 병합 → 검사 → Git commit/push → Pages 배포.
- 매월 2·12·22일 10:00 한국시간: 관세청 인증키가 등록된 경우 공식 API를 조회 → 과거 수정치 반영 → 수집본과 누적 데이터 저장 → 검사 → Git commit/push → Pages 배포.
- 수동 `Run workflow`: 두 자료를 갱신한 뒤 저장·배포합니다.
- `main` 코드 push: 저장된 데이터로 검사·배포합니다. 외부 자료는 다시 수집하지 않습니다.

봇 push는 다음 workflow를 자동 실행하지 않으므로, 데이터를 저장한 같은 실행에서 직접 배포합니다. 새 자료를 찾지 못하거나 검증에 실패하면 push·배포하지 않아 기존 공개 자료를 유지합니다. 공개 저장소의 예약 실행은 GitHub 정책에 따라 비활성화될 수 있으므로 Actions 실패·비활성 상태를 확인하세요. 예약 시간은 실행 대기열에 따라 지연될 수 있습니다.

산업통상부 추출기는 현재 연간 합계+13개월 형식을 지원합니다. 표 형식이 달라지면 잘못된 수치를 저장하지 않고 실패합니다. 수동 복구 시 `config/report.json`의 검증된 보고서 설정을 수정하고 `python scripts/fetch-report.py`를 실행할 수 있습니다.

## 관세청 연결 (최초 1회)

1. https://www.data.go.kr/data/15157908/openapi.do 에서 활용신청합니다. 서비스명은 **관세청_수출 주요품목별 10일 단위 잠정치 통계**입니다.
2. 저장소 Settings → Secrets and variables → Actions → New repository secret에 `CUSTOMS_API_KEY`라는 이름으로 공공데이터포털 인증키를 등록합니다. 키는 소스코드나 채팅에 넣지 않습니다.
3. Actions → Publish dashboard → Run workflow를 실행합니다.

최초 조회는 2024년 1월부터입니다. 관세청 API는 매월 11일·21일·익월 1일에 각각 1~10일·1~20일·월 전체를 제공합니다. 매번 저장된 전체 기간을 다시 조회하여 정정 내역도 반영합니다. 이 서비스의 실제 응답 연결 검증은 인증키 등록 후 완료할 수 있습니다. API 응답 형식이 명세와 다르면 기존 자료를 보존하고 실패합니다.

현재는 수출 API만 연결합니다. 수입과 KOSIS는 별도로 추가할 수 있습니다. KOSIS 키로 관세청 API를 호출할 수 없습니다.

## 로컬 실행

- `node scripts/serve.mjs`: http://127.0.0.1:4173/
- `node --test`: 지표와 화면 데이터 검사
- `python -m pip install -r requirements.txt`
- `python -m unittest discover -s tests -p "test_*.py"`: 수집기 검사
- `python scripts/update-monthly.py`: 전월 공식 보고서 검색·누적
- `python scripts/fetch-customs.py`: 환경변수 CUSTOMS_API_KEY로 관세청 수집

현재 공개 화면은 `dist/`입니다. 기존 KOSIS 수집기와 샘플 생성기는 정기 실행에서 사용하지 않습니다. 샘플 생성기를 실행하면 실자료를 덮어쓸 수 있으므로 주의하세요.
