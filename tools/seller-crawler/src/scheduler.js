const cron = require('node-cron');
const config = require('./config');
const logger = require('./logger');
const { run } = require('./index');

if (!cron.validate(config.scheduleCron)) {
  logger.error(`잘못된 SCHEDULE_CRON 표현식: ${config.scheduleCron}`);
  process.exit(1);
}

logger.info(`스케줄러 시작. cron="${config.scheduleCron}" tz="${config.timezone}"`);

cron.schedule(config.scheduleCron, () => {
  logger.info('예약된 수집 작업을 시작합니다.');
  run().catch((err) => logger.error('예약 작업 실패:', err));
}, { timezone: config.timezone });

// 시작 시 1회 즉시 실행
run().catch((err) => logger.error('초기 실행 실패:', err));
