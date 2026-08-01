const https = require('https');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

const HOST = 'api-gateway.coupang.com';
const SETTLEMENT_HISTORIES_PATH = '/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories';

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

function requestJson (method, path, query) {
  const { accessKey, secretKey } = config.coupangApi;
  if (!accessKey || !secretKey) {
    return Promise.reject(new Error('COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 설정되어 있지 않습니다.'));
  }

  const authorization = buildAuthorizationHeader(method, path, query, accessKey, secretKey);

  const options = {
    hostname: HOST,
    path: query ? `${path}?${query}` : path,
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(body ? JSON.parse(body) : null);
        } catch (err) {
          reject(new Error(`응답 JSON 파싱 실패: ${err.message} / body=${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 지급내역조회: 매출인식월(YYYY-MM) 기준 지급 확정/예정 내역
async function fetchSettlementHistories (revenueRecognitionYearMonth) {
  const query = `revenueRecognitionYearMonth=${revenueRecognitionYearMonth}`;
  return requestJson('GET', SETTLEMENT_HISTORIES_PATH, query);
}

async function collect () {
  const months = config.coupangApi.settlementMonths;
  const settlementHistories = {};

  for (const month of months) {
    try {
      logger.info(`[coupang] ${month} 지급내역 조회 중...`);
      settlementHistories[month] = await fetchSettlementHistories(month);
    } catch (err) {
      logger.error(`[coupang] ${month} 지급내역 조회 실패:`, err.message);
      settlementHistories[month] = { error: err.message };
    }
  }

  return { settlementHistories };
}

module.exports = { collect, fetchSettlementHistories, buildAuthorizationHeader };
