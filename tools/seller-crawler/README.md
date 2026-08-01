# Seller Crawler

쿠팡과 네이버 스마트스토어 판매자 계정의 정산/입금 정보 등을 주기적으로 읽어와 JSON 파일로 저장하는 도구입니다.

- **쿠팡**: [Coupang Open API](https://developers.coupang.com/ko/api)(공식 REST API, HMAC 서명 인증)를 사용합니다.
- **네이버 스마트스토어**: 아직 공식 API 연동 정보가 없어, 스마트스토어센터에 **본인 계정으로 로그인**한 세션을 저장해두고 브라우저 자동화(Playwright)로 페이지를 읽어옵니다.

> 본인이 소유/운영하는 계정에 한해 사용하세요. 각 플랫폼의 이용약관 및 자동화 정책을 확인하고, 과도한 요청으로 서비스에 부담을 주지 않도록 수집 주기를 적절히 설정하세요.

## 설치

```bash
cd tools/seller-crawler
npm install
npx playwright install chromium   # 네이버 수집에 필요
cp .env.example .env              # 값 채우기
```

## 쿠팡: Open API 설정

1. WING(https://wing.coupang.com) > 오픈 API 관리 메뉴에서 **Access Key / Secret Key**를 발급받습니다.
2. `.env`에 다음 값을 채웁니다.
   ```
   COUPANG_ACCESS_KEY=...
   COUPANG_SECRET_KEY=...
   COUPANG_VENDOR_ID=...          # (선택, 추후 다른 API 확장 시 사용)
   COUPANG_SETTLEMENT_MONTHS=2026-07,2026-08   # 비워두면 이번 달만 조회
   ```
3. 별도 로그인/세션 저장이 필요 없습니다. `npm run run` 실행 시 바로 API를 호출합니다.

현재 연동된 API: **지급내역조회** (`GET /v2/providers/marketplace_openapi/apis/api/v1/settlement-histories`) — 매출인식월(YYYY-MM) 기준으로 지급 확정/예정 내역(정산유형, 정산일, 총판매액, 수수료, 지급액, 최종지급액, 계좌 정보, 지급 상태 등)을 조회합니다. `src/platforms/coupang-api.js` 참고. 다른 쿠팡 API(주문, 상품 등)를 추가하려면 같은 파일에 서명 로직(`buildAuthorizationHeader`)을 재사용해 엔드포인트만 추가하면 됩니다.

## 네이버: 브라우저 세션 로그인

캡차/2단계인증 때문에 아이디·비밀번호를 코드에 넣어 완전 자동으로 로그인하는 방식은 신뢰할 수 없습니다. 대신 **최초 1회는 직접 브라우저에서 로그인**하고, 로그인된 세션(쿠키)을 로컬에 저장해 재사용합니다.

```bash
npm run login:naver
```

브라우저 창이 뜨면 직접 로그인(캡차/2단계인증 포함)을 완료한 뒤, 관리자 페이지가 정상적으로 보이는 것을 확인하고 터미널에서 Enter를 누르세요. `.auth/naver.json`에 세션이 저장됩니다. (이 파일은 로그인 쿠키를 담고 있으므로 절대 커밋하거나 공유하지 마세요. `.gitignore`에 이미 제외되어 있습니다.) 세션이 만료되면 다시 로그인해야 합니다.

로그인 후 `config/selectors.json`의 `naver` 항목을 열어, 크롬 개발자도구(F12)로 실제 정산 페이지의 URL과 CSS 셀렉터를 확인해 `REPLACE_WITH_...` 부분을 채워 넣으세요.

- `url`: 데이터를 읽어올 페이지 주소
- `waitForSelector`: 페이지 로딩이 끝났다고 판단할 기준 셀렉터
- `type: "table"`인 경우 `rowSelector`(행 셀렉터)와 `columns`(열 이름 → 셀 셀렉터)를 지정
- `type`을 생략하면 `fields`(필드 이름 → 셀렉터)로 단일 값들을 추출

네이버도 커머스 API(오픈 API)를 사용하고 싶다면 인증 방식과 엔드포인트 문서를 알려주시면 쿠팡처럼 API 기반으로 전환할 수 있습니다.

## 실행

```bash
npm run run          # 1회 실행 (data/latest.json, data/result-<timestamp>.json 저장)
npm run schedule      # .env 의 SCHEDULE_CRON(기본 매일 09:00)에 따라 주기적으로 자동 수집
```

`PLATFORMS` 환경변수(기본 `coupang,naver`)로 실행할 플랫폼을 제한할 수 있습니다. 예: `PLATFORMS=coupang`

## 참고

- 쿠팡 API 인증 실패(401 등)가 발생하면 Access/Secret Key와 서버 시간(서명에 사용되는 UTC 시각)을 확인하세요.
- 네이버는 사이트 개편으로 셀렉터가 깨질 수 있으니 수집 결과에 `error` 필드가 있으면 `config/selectors.json`을 다시 점검하세요.
- `.env`와 `.auth/`의 세션 파일은 민감 정보이므로 안전하게 보관하세요.
