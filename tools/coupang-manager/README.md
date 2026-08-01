# Coupang Manager

쿠팡 Open API를 이용해 **여러 판매자 계정**의 반품/취소 요청을 조회·처리하고 정산 내역을 확인할 수 있는 웹 대시보드입니다. 백엔드(Express)가 계정별 Access/Secret Key를 서버에만 보관하고 HMAC 서명을 붙여 쿠팡 API를 호출하며, 브라우저에는 비밀키가 전혀 노출되지 않습니다.

`https://developers.coupang.com/ko/api` 문서의 **반품 API(7종)** 와 **정산 > 지급내역조회**를 기반으로 만들었습니다.

## 포함된 기능

반품 API Flow(반품/취소요청목록조회 → 상품회수/입고확인 → 승인처리 → 완료)에 대응하는 화면을 제공합니다.

- 반품 / 취소 요청 목록 조회, 단건 상세 조회
- 반품상품 입고 확인처리
- 반품요청 승인 처리 (환불 처리)
- 회수 송장 등록 (자체 회수 판매자용, 200여개 택배사 코드 내장)
- 반품철회 이력 조회 (기간별 / 접수번호별)
- 정산 지급내역조회 (매출인식월 기준)
- 상단에서 여러 판매자 계정을 전환하며 조회/처리 가능

## 설치

```bash
cd tools/coupang-manager
npm install
cp .env.example .env
cp config/accounts.example.json config/accounts.json
```

`config/accounts.json`에 보유하신 쿠팡 판매자 계정을 모두 등록하세요. Access/Secret Key는 WING(https://wing.coupang.com) > 오픈 API 관리 메뉴에서 계정별로 발급받습니다.

```json
[
  { "name": "스토어1", "vendorId": "A00012345", "accessKey": "...", "secretKey": "..." },
  { "name": "스토어2", "vendorId": "A00067890", "accessKey": "...", "secretKey": "..." }
]
```

`config/accounts.json`은 `.gitignore`에 포함되어 있어 커밋되지 않습니다. 절대 공유하거나 저장소에 올리지 마세요.

## 실행

```bash
npm start
```

기본적으로 `http://127.0.0.1:4000` 에서만 접속 가능합니다 (`.env`의 `HOST`). 브라우저로 접속해 상단에서 계정을 선택한 뒤 사용하세요.

외부(다른 기기)에서 접속하려면 `.env`의 `HOST`를 `0.0.0.0`으로 바꿀 수 있지만, 이 프로그램 자체에는 로그인/인증이 없으므로 반드시 리버스 프록시 등으로 접근을 제한한 뒤 사용하세요.

## 화면 구성

- **반품 / 취소 요청**: 기간·상태·유형으로 조회 후, 각 건에 대해 상세보기 / 입고확인 / 승인처리 / 회수송장등록을 수행합니다. 상태에 따라 처리 가능한 버튼만 표시됩니다.
  - 반품접수(RETURNS_UNCHECKED) → [입고확인] 가능
  - 입고완료(VENDOR_WAREHOUSE_CONFIRM) → [승인처리] 가능 (승인 시 환불 처리됨)
  - 반품완료(RETURNS_COMPLETED) 전까지 → [송장등록] 가능
- **반품철회 이력**: 기간별(최대 7일) 또는 접수번호(최대 50개)로 철회 이력을 조회합니다.
- **정산 내역**: 매출인식월(YYYY-MM, 쉼표로 여러 달 동시 조회 가능)을 기준으로 지급 확정/예정 내역을 조회합니다.

## API 매핑

| 화면 기능 | Coupang API | Method / Path |
|---|---|---|
| 목록 조회 | 반품/취소 요청 목록 조회 | `GET /v2/.../vendors/{vendorId}/returnRequests` |
| 상세 조회 | 반품요청 단건 조회 | `GET /v2/.../vendors/{vendorId}/returnRequests/{receiptId}` |
| 입고확인 | 반품상품 입고 확인처리 | `PATCH /v2/.../returnRequests/{receiptId}/receiveConfirmation` |
| 승인처리 | 반품요청 승인 처리 | `PATCH /v2/.../returnRequests/{receiptId}/approval` |
| 송장등록 | 회수 송장 등록 | `POST /v2/.../return-exchange-invoices/manual` |
| 철회이력(기간별) | 반품철회 이력 기간별 조회 | `GET /v2/.../returnWithdrawRequests` |
| 철회이력(접수번호) | 반품철회 이력 접수번호로 조회 | `POST /v2/.../returnWithdrawList` |
| 정산 내역 | 지급내역조회 | `GET /v2/.../settlement-histories` |

## 참고

- 승인처리(approval)는 반품이 실제로 환불 처리되는 동작이므로, 대상 건과 수량(cancelCount)을 확인 후 실행하세요.
- 회수 송장 등록은 반품자동연동(굿스플로)을 사용하지 않고 직접 회수하는 판매자만 필요합니다.
- 다른 쿠팡 API(상품/주문/교환 등)를 추가하고 싶다면 `src/coupangClient.js`의 서명 로직(`buildAuthorizationHeader`, `request`)을 재사용해 엔드포인트만 추가하면 됩니다.
