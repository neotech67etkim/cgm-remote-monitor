const { openAuthenticatedContext } = require('../browser');
const { extractAllPages } = require('../extract');
const config = require('../config');

async function collect () {
  const { browser, context } = await openAuthenticatedContext('naver');
  try {
    const page = await context.newPage();
    return await extractAllPages(page, config.selectors.naver.pages, 'naver');
  } finally {
    await browser.close();
  }
}

module.exports = { collect };
