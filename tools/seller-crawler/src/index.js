const config = require('./config');
const logger = require('./logger');
const { hasSavedSession } = require('./browser');
const { saveResult } = require('./storage');

// coupang 은 공식 Open API(HMAC 인증)를 사용하므로 브라우저 로그인 세션이 필요 없습니다.
const collectors = {
  coupang: { collector: require('./platforms/coupang-api'), requiresSession: false },
  naver: { collector: require('./platforms/naver'), requiresSession: true }
};

async function run () {
  const result = { collectedAt: new Date().toISOString(), platforms: {} };

  for (const platform of config.platforms) {
    const entry = collectors[platform];
    if (!entry) {
      logger.warn(`알 수 없는 플랫폼: ${platform}`);
      continue;
    }
    if (entry.requiresSession && !hasSavedSession(platform)) {
      logger.warn(`${platform}: 저장된 로그인 세션이 없어 건너뜁니다. "npm run login:${platform}" 을 먼저 실행하세요.`);
      result.platforms[platform] = { error: 'no saved session' };
      continue;
    }

    try {
      result.platforms[platform] = await entry.collector.collect();
    } catch (err) {
      logger.error(`${platform} 수집 실패:`, err.message);
      result.platforms[platform] = { error: err.message };
    }
  }

  const filePath = saveResult(result);
  logger.info(`결과 저장 완료: ${filePath}`);
  return result;
}

if (require.main === module) {
  run().catch((err) => {
    logger.error('실행 중 오류:', err);
    process.exit(1);
  });
}

module.exports = { run };
