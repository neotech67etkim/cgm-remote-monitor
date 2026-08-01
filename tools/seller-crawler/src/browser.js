const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('./config');

function storageStatePath (platform) {
  return path.join(config.authDir, `${platform}.json`);
}

function hasSavedSession (platform) {
  return fs.existsSync(storageStatePath(platform));
}

async function openAuthenticatedContext (platform, { headless = config.headless } = {}) {
  const statePath = storageStatePath(platform);
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `${platform} 저장된 로그인 세션이 없습니다. 먼저 "npm run login:${platform}" 을 실행해 로그인하세요.`
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: statePath });
  return { browser, context };
}

module.exports = {
  storageStatePath,
  hasSavedSession,
  openAuthenticatedContext
};
