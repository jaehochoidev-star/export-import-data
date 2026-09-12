# 20대 주요 수출품목 대시보드

공개 주소: https://jaehochoidev-star.github.io/export-import-data/

## 실제 자료와 출처

산업통상부 수출입동향 보도자료 PDF만 사용합니다. KOSIS API 키는 필요 없습니다.

- 2025.08~2026.08: 산업통상부 「2026년 8월 수출입동향」 20~21쪽을 직접 추출. 백만 달러를 억 달러로 환산합니다.
- 전체 20개 품목의 수록기간은 2025.08~2026.08입니다.
- 각 월의 출처를 원자료 표에 표시합니다.
- 공식 공표 YoY를 우선합니다. 반올림된 수출액으로 재계산한 YoY와 작은 차이가 있을 수 있습니다.

공식 원문: https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/172145/view
정부 정책브리핑: https://www.korea.kr/briefing/pressReleaseView.do?newsId=156776348

공공누리 제1유형(출처표시). 정부 공식 사이트가 아니며 정부의 후원·보증과 무관합니다.

## 화면

20개 품목 각각 수출액·12M MA 그래프, YoY 그래프, 8개 요약 지표, 자체 분류와 설명, 월별 원자료를 제공합니다. 계산에 필요한 연속 월이 없으면 이동평균은 —로 표시합니다. 공표 YoY가 있으면 과거 금액이 없어도 성장률을 표시합니다.

ΔYoY = 이번 달 YoY − 전월 YoY (%p). 3개월 평균 = 해당 월 및 직전 2개월 지표 평균. 12M MA = 해당 월 포함 12개월 수출액 평균. MA 대비 = (수출액 / MA − 1) × 100. 화면의 지표 설명에 자체 상태 분류 기준도 공개되어 있습니다.

## GitHub Actions 배포

Pages Source는 GitHub Actions입니다. `main` 푸시 또는 Actions → Publish dashboard → Run workflow로 실행합니다.

1. Python PDF 리더 설치
2. `config/report.json`에 등록된 **공식 PDF**를 다운로드
3. 20개 품목·월별 열·단위를 검증하고 공식 자료만 저장
4. 계산 및 화면 데이터 테스트
5. `dist/`만 GitHub Pages에 배포

새 PDF를 수집하거나 검증하는 데 실패하면 기존 공개 페이지를 유지합니다. 가상 데이터로 대체하지 않습니다. 비밀키는 필요하지 않으며 파이프라인은 KOSIS를 호출하지 않습니다.

### 다음 달 갱신

현재는 지정한 보도자료를 다시 수집하는 방식입니다. **새 보도자료 자동 검색과 정기 실행은 아직 구현하지 않았습니다.** 다음 달에는 공식 보도자료 확인 후 `config/report.json`의 URL, 제목, 공표일, 기간과 표 쪽수를 갱신하고 실행합니다. 현재 추출기는 연간 합계+13개월 표를 지원하며 표 형식이 바뀌면 실패하도록 되어 있습니다. 현재는 지정 PDF에 수록된 13개월만 표시합니다.

## 로컬

`node scripts/serve.mjs` → http://127.0.0.1:4173/
`node --test` → JavaScript 검증
Python 3.12 이상: `python -m pip install -r requirements.txt` 후 `python scripts/fetch-report.py`로 공식 PDF 수집. 이미 받은 PDF는 `python scripts/fetch-report.py 경로.pdf`로 사용합니다.

## 구조

- `config/report.json`: 검증된 공식 자료 URL 및 추출 범위
- `scripts/fetch-report.py`: 공식 PDF 파싱
- `config/products.json`: 공식 표의 20개 품목 목록
- `dist/data/products.json`: 출처·문서 해시·월별 수출액·공표 YoY를 포함한 배포 자료
- `dist/products.js`: 지표 계산과 자체 분류
- `dist/render.js`: 품목별 화면
- `.github/workflows/pages.yml`: 공식 자료 수집 후 배포

기존 `scripts/fetch-kosis.mjs`와 `config/kosis.json`은 향후 KOSIS 통계표가 확정됐을 때 사용할 별도 수집기로 보존하며, 현재 Actions와는 연결하지 않습니다. `scripts/create-sample.mjs`는 예시 데이터 생성용이므로 실제 자료를 유지하려면 실행하지 마세요. 총계용 trade.json/stats.js는 현재 화면에서 사용하지 않습니다.
