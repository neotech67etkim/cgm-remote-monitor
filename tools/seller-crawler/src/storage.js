const fs = require('fs');
const path = require('path');
const config = require('./config');

function saveResult (result) {
  fs.mkdirSync(config.outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(config.outputDir, `result-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');

  const latestPath = path.join(config.outputDir, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(result, null, 2), 'utf8');

  return filePath;
}

module.exports = { saveResult };
