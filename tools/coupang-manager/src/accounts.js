const fs = require('fs');
const path = require('path');

const ACCOUNTS_PATH = path.resolve(__dirname, '..', 'config', 'accounts.json');

function loadAccounts () {
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    throw new Error(`계정 설정 파일이 없습니다: ${ACCOUNTS_PATH} (config/accounts.example.json 을 복사해 생성하세요)`);
  }

  const raw = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('config/accounts.json 에 최소 1개 이상의 계정을 등록하세요.');
  }

  for (const acc of raw) {
    if (!acc.name || !acc.vendorId || !acc.accessKey || !acc.secretKey) {
      throw new Error(`계정 설정이 올바르지 않습니다 (name/vendorId/accessKey/secretKey 필요): ${acc.name || '(이름없음)'}`);
    }
  }

  return raw;
}

function publicAccounts (accounts) {
  return accounts.map(({ name, vendorId }) => ({ name, vendorId }));
}

function findAccount (accounts, name) {
  const account = accounts.find((a) => a.name === name);
  if (!account) {
    throw new Error(`알 수 없는 계정: ${name}`);
  }
  return account;
}

module.exports = { loadAccounts, publicAccounts, findAccount };
