const logger = require('./logger');

async function extractTable (page, pageConfig) {
  const rows = page.locator(pageConfig.rowSelector);
  const count = await rows.count();
  const results = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const record = {};
    for (const [field, selector] of Object.entries(pageConfig.columns)) {
      try {
        record[field] = (await row.locator(selector).innerText()).trim();
      } catch (err) {
        record[field] = null;
      }
    }
    results.push(record);
  }

  return results;
}

async function extractFields (page, pageConfig) {
  const record = {};
  for (const [field, selector] of Object.entries(pageConfig.fields || {})) {
    try {
      record[field] = (await page.locator(selector).innerText()).trim();
    } catch (err) {
      record[field] = null;
    }
  }
  return record;
}

async function extractPage (page, pageConfig) {
  await page.goto(pageConfig.url, { waitUntil: 'domcontentloaded' });

  if (pageConfig.waitForSelector) {
    await page.waitForSelector(pageConfig.waitForSelector, { timeout: 30000 });
  }

  if (pageConfig.type === 'table') {
    return extractTable(page, pageConfig);
  }
  return extractFields(page, pageConfig);
}

async function extractAllPages (page, pagesConfig, platform) {
  const output = {};
  for (const pageConfig of pagesConfig) {
    try {
      logger.info(`[${platform}] "${pageConfig.name}" 페이지 수집 중...`);
      output[pageConfig.name] = await extractPage(page, pageConfig);
    } catch (err) {
      logger.error(`[${platform}] "${pageConfig.name}" 수집 실패:`, err.message);
      output[pageConfig.name] = { error: err.message };
    }
  }
  return output;
}

module.exports = { extractPage, extractAllPages };
