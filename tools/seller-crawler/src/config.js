const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const selectors = require('../config/selectors.json');

function parsePlatforms () {
  return (process.env.PLATFORMS || 'coupang,naver')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

function currentYearMonthUTC () {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseSettlementMonths () {
  const raw = process.env.COUPANG_SETTLEMENT_MONTHS;
  if (raw) {
    return raw.split(',').map((m) => m.trim()).filter(Boolean);
  }
  return [currentYearMonthUTC()];
}

module.exports = {
  platforms: parsePlatforms(),
  headless: process.env.HEADLESS !== 'false',
  outputDir: path.resolve(__dirname, '..', process.env.OUTPUT_DIR || './data'),
  authDir: path.resolve(__dirname, '..', '.auth'),
  scheduleCron: process.env.SCHEDULE_CRON || '0 9 * * *',
  timezone: process.env.TZ || 'Asia/Seoul',
  selectors,
  loginUrls: {
    naver: process.env.NAVER_LOGIN_URL
  },
  coupangApi: {
    accessKey: process.env.COUPANG_ACCESS_KEY,
    secretKey: process.env.COUPANG_SECRET_KEY,
    vendorId: process.env.COUPANG_VENDOR_ID,
    settlementMonths: parseSettlementMonths()
  }
};
