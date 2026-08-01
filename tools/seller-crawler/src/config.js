const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const selectors = require('../config/selectors.json');

function parsePlatforms () {
  return (process.env.PLATFORMS || 'coupang,naver')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
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
    coupang: process.env.COUPANG_LOGIN_URL,
    naver: process.env.NAVER_LOGIN_URL
  }
};
