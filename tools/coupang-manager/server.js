const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const { loadAccounts, publicAccounts, findAccount } = require('./src/accounts');
const coupang = require('./src/coupangClient');
const couriers = require('./src/couriers.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function accountsOrFail (res) {
  try {
    return loadAccounts();
  } catch (err) {
    res.status(500).json({ error: err.message });
    return null;
  }
}

function withAccount (req, res, accounts) {
  const name = req.query.account || (req.body && req.body.account);
  if (!name) {
    res.status(400).json({ error: 'account 파라미터가 필요합니다.' });
    return null;
  }
  try {
    return findAccount(accounts, name);
  } catch (err) {
    res.status(404).json({ error: err.message });
    return null;
  }
}

app.get('/api/accounts', (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  res.json(publicAccounts(accounts));
});

app.get('/api/couriers', (req, res) => {
  res.json(couriers);
});

app.get('/api/returns', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;

  const { searchType, createdAtFrom, createdAtTo, status, cancelType, nextToken, maxPerPage, orderId } = req.query;
  try {
    const data = await coupang.listReturnRequests(account, {
      searchType, createdAtFrom, createdAtTo, status, cancelType, nextToken, maxPerPage, orderId
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/returns/:receiptId', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  try {
    const data = await coupang.getReturnRequest(account, req.params.receiptId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch('/api/returns/:receiptId/receive-confirmation', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  try {
    const data = await coupang.receiveConfirmation(account, req.params.receiptId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch('/api/returns/:receiptId/approval', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  const { cancelCount } = req.body;
  if (cancelCount === undefined) {
    res.status(400).json({ error: 'cancelCount 가 필요합니다.' });
    return;
  }
  try {
    const data = await coupang.approveReturn(account, req.params.receiptId, cancelCount);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/returns/:receiptId/invoice', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  const { returnExchangeDeliveryType, deliveryCompanyCode, invoiceNumber, regNumber } = req.body;
  if (!returnExchangeDeliveryType || !deliveryCompanyCode || !invoiceNumber) {
    res.status(400).json({ error: 'returnExchangeDeliveryType, deliveryCompanyCode, invoiceNumber 는 필수입니다.' });
    return;
  }
  try {
    const data = await coupang.registerReturnInvoice(account, {
      receiptId: req.params.receiptId,
      returnExchangeDeliveryType,
      deliveryCompanyCode,
      invoiceNumber,
      regNumber
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/return-withdrawals', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  const { dateFrom, dateTo, pageIndex, sizePerPage } = req.query;
  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: 'dateFrom, dateTo 가 필요합니다.' });
    return;
  }
  try {
    const data = await coupang.listReturnWithdrawals(account, { dateFrom, dateTo, pageIndex, sizePerPage });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/return-withdrawals/query', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  const { cancelIds } = req.body;
  if (!Array.isArray(cancelIds) || cancelIds.length === 0) {
    res.status(400).json({ error: 'cancelIds 배열이 필요합니다.' });
    return;
  }
  try {
    const data = await coupang.queryReturnWithdrawals(account, cancelIds);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/settlement', async (req, res) => {
  const accounts = accountsOrFail(res);
  if (!accounts) return;
  const account = withAccount(req, res, accounts);
  if (!account) return;
  const months = String(req.query.months || '').split(',').map((m) => m.trim()).filter(Boolean);
  if (months.length === 0) {
    res.status(400).json({ error: 'months 파라미터가 필요합니다. 예: months=2026-07,2026-08' });
    return;
  }
  try {
    const results = {};
    for (const month of months) {
      results[month] = await coupang.fetchSettlementHistories(account, month);
    }
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Coupang manager running at http://${HOST}:${PORT}`);
});

module.exports = app;
