const fs = require('fs');
const readline = require('readline');
const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./logger');
const { storageStatePath } = require('./browser');

function waitForEnter (question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => {
    rl.close();
    resolve();
  }));
}

async function main () {
  const platform = process.argv[2];
  if (!platform || !config.loginUrls[platform]) {
    logger.error('사용법: node src/login.js <coupang|naver>  (.env 에 로그인 URL이 설정되어 있어야 합니다)');
    process.exit(1);
  }

  fs.mkdirSync(config.authDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(config.loginUrls[platform]);

  logger.info(`브라우저에서 ${platform} 로그인(캡차/2단계인증 포함)을 직접 완료한 뒤, 관리자 페이지 진입이 확인되면 터미널로 돌아와 Enter 를 눌러주세요.`);
  await waitForEnter('로그인 완료 후 Enter > ');

  await context.storageState({ path: storageStatePath(platform) });
  logger.info(`세션을 저장했습니다: ${storageStatePath(platform)}`);

  await browser.close();
}

main().catch((err) => {
  logger.error('로그인 저장 중 오류:', err);
  process.exit(1);
});
