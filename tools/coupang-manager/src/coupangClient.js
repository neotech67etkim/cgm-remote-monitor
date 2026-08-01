const https = require('https');
const crypto = require('crypto');

const HOST = 'api-gateway.coupang.com';

function pad (n) {
  return String(n).padStart(2, '0');
}

// Coupang Open API 서명 규격: yyMMdd'T'HHmmss'Z' (UTC)
function signedDate () {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${yy}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildAuthorizationHeader (method, path, query, accessKey, secretKey) {
  const datetime = signedDate();
  const message = `${datetime}${method}${path}${query}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

function cleanParams (params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

function request (account, method, path, queryParams, body) {
  const query = queryParams ? new URLSearchParams(cleanParams(queryParams)).toString() : '';
  const authorization = buildAuthorizationHeader(method, path, query, account.accessKey, account.secretKey);
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    hostname: HOST,
    path: query ? `${path}?${query}` : path,
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = null;
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch (err) {
            reject(new Error(`응답 JSON 파싱 실패: ${err.message} / body=${raw}`));
            return;
          }
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = (parsed && parsed.message) || raw || `HTTP ${res.statusCode}`;
          reject(new Error(`HTTP ${res.statusCode}: ${message}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const paths = {
  returnList: (vendorId) => `/v2/providers/openapi/apis/api/v6/vendors/${vendorId}/returnRequests`,
  returnSingle: (vendorId, receiptId) => `/v2/providers/openapi/apis/api/v6/vendors/${vendorId}/returnRequests/${receiptId}`,
  receiveConfirmation: (vendorId, receiptId) => `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnRequests/${receiptId}/receiveConfirmation`,
  approval: (vendorId, receiptId) => `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnRequests/${receiptId}/approval`,
  withdrawByDate: (vendorId) => `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnWithdrawRequests`,
  withdrawByIds: (vendorId) => `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnWithdrawList`,
  invoice: (vendorId) => `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/return-exchange-invoices/manual`,
  settlement: () => '/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories'
};

// GET 반품/취소 요청 목록 조회
function listReturnRequests (account, params) {
  return request(account, 'GET', paths.returnList(account.vendorId), params);
}

// GET 반품요청 단건 조회
function getReturnRequest (account, receiptId) {
  return request(account, 'GET', paths.returnSingle(account.vendorId, receiptId));
}

// PATCH 반품상품 입고 확인처리
function receiveConfirmation (account, receiptId) {
  return request(account, 'PATCH', paths.receiveConfirmation(account.vendorId, receiptId), null, {
    vendorId: account.vendorId,
    receiptId: Number(receiptId)
  });
}

// PATCH 반품요청 승인 처리
function approveReturn (account, receiptId, cancelCount) {
  return request(account, 'PATCH', paths.approval(account.vendorId, receiptId), null, {
    vendorId: account.vendorId,
    receiptId: Number(receiptId),
    cancelCount: Number(cancelCount)
  });
}

// GET 반품철회 이력 기간별 조회
function listReturnWithdrawals (account, params) {
  return request(account, 'GET', paths.withdrawByDate(account.vendorId), params);
}

// POST 반품철회 이력 접수번호로 조회
function queryReturnWithdrawals (account, cancelIds) {
  return request(account, 'POST', paths.withdrawByIds(account.vendorId), null, {
    cancelIds: cancelIds.map(Number)
  });
}

// POST 회수 송장 등록
function registerReturnInvoice (account, payload) {
  const body = {
    returnExchangeDeliveryType: payload.returnExchangeDeliveryType,
    receiptId: Number(payload.receiptId),
    deliveryCompanyCode: payload.deliveryCompanyCode,
    invoiceNumber: payload.invoiceNumber
  };
  if (payload.regNumber) {
    body.regNumber = payload.regNumber;
  }
  return request(account, 'POST', paths.invoice(account.vendorId), null, body);
}

// GET 지급내역조회 (정산)
function fetchSettlementHistories (account, revenueRecognitionYearMonth) {
  return request(account, 'GET', paths.settlement(), { revenueRecognitionYearMonth });
}

module.exports = {
  buildAuthorizationHeader,
  listReturnRequests,
  getReturnRequest,
  receiveConfirmation,
  approveReturn,
  listReturnWithdrawals,
  queryReturnWithdrawals,
  registerReturnInvoice,
  fetchSettlementHistories
};
