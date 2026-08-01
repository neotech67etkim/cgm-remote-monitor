const config = require('./config');
const logger = require('./logger');
const { hasSavedSession } = require('./browser');
const { saveResult } = require('./storage');

const collectors = {
  coupang: require('./platforms/coupang'),
  naver: require('./platforms/naver')
};

async function run () {
  const result = { collectedAt: new Date().toISOString(), platforms: {} };

  for (const platform of config.platforms) {
    const collector = collectors[platform];
    if (!collector) {
      logger.warn(`알 수 없는 플랫폼: ${platform}`);
      continue;
    }
    if (!hasSavedSession(platform)) {
      logger.warn(`${platform}: 저장된 로그인 세션이 없어 건너뜁니다. "npm run login:${platform}" 을 먼저 실행하세요.`);
      result.platforms[platform] = { error: 'no saved session' };
      continue;
    }

    try {
      result.platforms[platform] = await collector.collect();
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
