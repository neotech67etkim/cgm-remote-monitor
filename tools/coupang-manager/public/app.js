const STATUS_LABELS = {
  RELEASE_STOP_UNCHECKED: '출고중지요청',
  RETURNS_UNCHECKED: '반품접수',
  VENDOR_WAREHOUSE_CONFIRM: '입고완료',
  REQUEST_COUPANG_CHECK: '쿠팡확인요청',
  RETURNS_COMPLETED: '반품완료'
};

const state = {
  account: null,
  returnsById: new Map(),
  lastReturnsQuery: null
};

function toast (message, isError) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', Boolean(isError));
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 4000);
}

async function api (path, options = {}) {
  const url = new URL(path, window.location.origin);
  if (state.account && !url.searchParams.has('account') && options.method !== 'POST' && options.method !== 'PATCH') {
    url.searchParams.set('account', state.account);
  }
  const opts = { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify({ account: state.account, ...opts.body });
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && data.error) || `요청 실패 (HTTP ${res.status})`;
    throw new Error(message);
  }
  return data;
}

function openModal (id) { document.getElementById(id).hidden = false; }
function closeModal (id) { document.getElementById(id).hidden = true; }

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]')) {
    e.target.closest('.modal').hidden = true;
  }
});

// ---- 계정 ----
async function initAccounts () {
  const select = document.getElementById('account-select');
  try {
    const accounts = await api('/api/accounts');
    select.innerHTML = accounts.map((a) => `<option value="${a.name}">${a.name} (${a.vendorId})</option>`).join('');
    const saved = localStorage.getItem('coupang-manager-account');
    if (saved && accounts.some((a) => a.name === saved)) {
      select.value = saved;
    }
    state.account = select.value;
    document.getElementById('account-status').textContent = accounts.length ? '' : '등록된 계정이 없습니다.';
  } catch (err) {
    document.getElementById('account-status').textContent = err.message;
  }

  select.addEventListener('change', () => {
    state.account = select.value;
    localStorage.setItem('coupang-manager-account', state.account);
  });
}

// ---- 탭 ----
function initTabs () {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ---- 반품/취소 요청 ----
function productSummary (item) {
  if (!item.returnItems || item.returnItems.length === 0) return '';
  const first = item.returnItems[0];
  const extra = item.returnItems.length > 1 ? ` 외 ${item.returnItems.length - 1}건` : '';
  return `${first.sellerProductName || first.vendorItemName || ''}${extra}`;
}

function renderReturnsTable (rows, append) {
  const tbody = document.querySelector('#returns-table tbody');
  if (!append) tbody.innerHTML = '';

  for (const item of rows) {
    state.returnsById.set(String(item.receiptId), item);
    const tr = document.createElement('tr');
    const statusLabel = STATUS_LABELS[item.receiptStatus] || item.receiptStatus;
    const canReceive = item.receiptStatus === 'RETURNS_UNCHECKED';
    const canApprove = item.receiptStatus === 'VENDOR_WAREHOUSE_CONFIRM';
    const canInvoice = item.receiptStatus !== 'RETURNS_COMPLETED';

    tr.innerHTML = `
      <td>${item.receiptId}</td>
      <td>${item.orderId}</td>
      <td>${statusLabel}</td>
      <td>${(item.createdAt || '').replace('T', ' ').slice(0, 19)}</td>
      <td>${item.requesterName || ''}</td>
      <td>${productSummary(item)}</td>
      <td>${item.cancelCountSum ?? ''}</td>
      <td>${item.reasonCodeText || ''}</td>
      <td class="actions"></td>
    `;

    const actionsCell = tr.querySelector('.actions');
    actionsCell.appendChild(makeButton('상세', 'small secondary', () => showDetail(item.receiptId)));
    if (canReceive) {
      actionsCell.appendChild(makeButton('입고확인', 'small', () => doReceiveConfirmation(item.receiptId)));
    }
    if (canApprove) {
      actionsCell.appendChild(makeButton('승인처리', 'small', () => showApprovalModal(item)));
    }
    if (canInvoice) {
      actionsCell.appendChild(makeButton('송장등록', 'small secondary', () => showInvoiceModal(item)));
    }

    tbody.appendChild(tr);
  }
}

function makeButton (label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

async function fetchReturns (query, append) {
  const params = new URLSearchParams({ account: state.account, ...query });
  const data = await api(`/api/returns?${params.toString()}`);
  const rows = data.data || [];
  renderReturnsTable(rows, append);
  document.getElementById('returns-meta').textContent = `${rows.length}건 조회됨`;

  const moreBtn = document.getElementById('returns-more');
  if (data.nextToken) {
    moreBtn.hidden = false;
    moreBtn.onclick = () => fetchReturns({ ...query, nextToken: data.nextToken }, true);
  } else {
    moreBtn.hidden = true;
  }
  state.lastReturnsQuery = query;
}

function initReturnsForm () {
  document.getElementById('returns-filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const searchTypeRaw = form.get('searchType');
    const query = {
      createdAtFrom: form.get('createdAtFrom'),
      createdAtTo: form.get('createdAtTo'),
      status: form.get('status') || undefined,
      cancelType: form.get('cancelType')
    };
    if (searchTypeRaw === 'timeFrame') {
      query.searchType = 'timeFrame';
    }
    try {
      await fetchReturns(query, false);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function showDetail (receiptId) {
  try {
    const data = await api(`/api/returns/${receiptId}`);
    document.getElementById('detail-content').textContent = JSON.stringify(data.data || data, null, 2);
    openModal('modal-detail');
  } catch (err) {
    toast(err.message, true);
  }
}

async function doReceiveConfirmation (receiptId) {
  if (!confirm(`접수번호 ${receiptId} 를 입고 확인 처리할까요?`)) return;
  try {
    await api(`/api/returns/${receiptId}/receive-confirmation`, { method: 'PATCH', body: {} });
    toast('입고 확인 처리되었습니다.');
    if (state.lastReturnsQuery) fetchReturns(state.lastReturnsQuery, false);
  } catch (err) {
    toast(err.message, true);
  }
}

function showApprovalModal (item) {
  const form = document.getElementById('approval-form');
  form.receiptId.value = item.receiptId;
  form.cancelCount.value = item.cancelCountSum || 1;
  openModal('modal-approval');
}

function initApprovalForm () {
  document.getElementById('approval-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const receiptId = form.get('receiptId');
    try {
      await api(`/api/returns/${receiptId}/approval`, {
        method: 'PATCH',
        body: { cancelCount: Number(form.get('cancelCount')) }
      });
      toast('승인 처리되었습니다.');
      closeModal('modal-approval');
      if (state.lastReturnsQuery) fetchReturns(state.lastReturnsQuery, false);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function showInvoiceModal (item) {
  const form = document.getElementById('invoice-form');
  form.receiptId.value = item.receiptId;
  form.invoiceNumber.value = '';
  form.regNumber.value = '';
  openModal('modal-invoice');
}

function initInvoiceForm () {
  document.getElementById('invoice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const receiptId = form.get('receiptId');
    try {
      await api(`/api/returns/${receiptId}/invoice`, {
        method: 'POST',
        body: {
          returnExchangeDeliveryType: form.get('returnExchangeDeliveryType'),
          deliveryCompanyCode: form.get('deliveryCompanyCode'),
          invoiceNumber: form.get('invoiceNumber'),
          regNumber: form.get('regNumber') || undefined
        }
      });
      toast('회수 송장이 등록되었습니다.');
      closeModal('modal-invoice');
      if (state.lastReturnsQuery) fetchReturns(state.lastReturnsQuery, false);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function initCouriers () {
  try {
    const couriers = await api('/api/couriers');
    const select = document.getElementById('invoice-courier');
    select.innerHTML = couriers.map((c) => `<option value="${c.code}">${c.name} (${c.code})</option>`).join('');
  } catch (err) {
    toast(err.message, true);
  }
}

// ---- 반품철회 이력 ----
function renderWithdrawalRows (tableId, rows) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${r.cancelId}</td>
      <td>${r.orderId}</td>
      <td>${r.refundDeliveryDuty || ''}</td>
      <td>${(r.createdAt || '').replace('T', ' ')}</td>
      <td>${(r.vendorItemIds || []).join(', ')}</td>
    </tr>
  `).join('');
}

function initWithdrawalForms () {
  document.getElementById('withdrawals-date-filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const params = new URLSearchParams({
      account: state.account,
      dateFrom: form.get('dateFrom'),
      dateTo: form.get('dateTo'),
      pageIndex: form.get('pageIndex'),
      sizePerPage: form.get('sizePerPage')
    });
    try {
      const data = await api(`/api/return-withdrawals?${params.toString()}`);
      renderWithdrawalRows('withdrawals-date-table', data.data || []);
    } catch (err) {
      toast(err.message, true);
    }
  });

  document.getElementById('withdrawals-id-filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const cancelIds = String(form.get('cancelIds') || '')
      .split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    try {
      const data = await api('/api/return-withdrawals/query', { method: 'POST', body: { cancelIds } });
      renderWithdrawalRows('withdrawals-id-table', data.data || []);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// ---- 정산 내역 ----
function currentYearMonth () {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function renderSettlement (results) {
  const container = document.getElementById('settlement-results');
  container.innerHTML = '';
  for (const [month, rows] of Object.entries(results)) {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.style.marginBottom = '1rem';

    if (rows && rows.error) {
      wrap.innerHTML = `<p class="muted">${month}: ${rows.error}</p>`;
      container.appendChild(wrap);
      continue;
    }

    const list = rows || [];
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th colspan="9">${month}</th>
          </tr>
          <tr>
            <th>정산유형</th><th>정산(예정)일</th><th>총판매액</th><th>판매수수료</th>
            <th>정산대상액</th><th>지급액</th><th>최종지급액</th><th>은행</th><th>상태</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((r) => `
            <tr>
              <td>${r.settlementType || ''}</td>
              <td>${r.settlementDate || ''}</td>
              <td>${(r.totalSale ?? '').toLocaleString?.() ?? r.totalSale}</td>
              <td>${(r.serviceFee ?? '').toLocaleString?.() ?? r.serviceFee}</td>
              <td>${(r.settlementTargetAmount ?? '').toLocaleString?.() ?? r.settlementTargetAmount}</td>
              <td>${(r.settlementAmount ?? '').toLocaleString?.() ?? r.settlementAmount}</td>
              <td>${(r.finalAmount ?? '').toLocaleString?.() ?? r.finalAmount}</td>
              <td>${r.bankName || ''} ${r.bankAccount || ''}</td>
              <td>${r.status || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.appendChild(wrap);
  }
}

function initSettlementForm () {
  const input = document.querySelector('#settlement-filter input[name="months"]');
  input.value = currentYearMonth();

  document.getElementById('settlement-filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const params = new URLSearchParams({ account: state.account, months: form.get('months') });
    try {
      const data = await api(`/api/settlement?${params.toString()}`);
      renderSettlement(data);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function main () {
  await initAccounts();
  initTabs();
  initReturnsForm();
  initApprovalForm();
  initInvoiceForm();
  initWithdrawalForms();
  initSettlementForm();
  await initCouriers();
}

main();
