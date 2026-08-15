import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  setPersistence, browserLocalPersistence, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  setDoc, getDoc, getDocs, query, orderBy, where, limit, documentId, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import Sortable from "https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/modular/sortable.esm.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBkfr3fwllyRGjfrrXXFk46x6ny0Vmxfc",
  authDomain: "fireboard-921a5.firebaseapp.com",
  projectId: "fireboard-921a5",
  storageBucket: "fireboard-921a5.firebasestorage.app",
  messagingSenderId: "964238785249",
  appId: "1:964238785249:web:2da19db64cf0a50ae255a0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ---- Static lists ----
const OTHER = '__other__';
const BANK_LIST = [
  'KB국민은행', '신한은행', '우리은행', '하나은행', 'IBK기업은행', 'NH농협은행',
  'SC제일은행', '한국씨티은행', '카카오뱅크', '케이뱅크', '토스뱅크',
  'iM뱅크(구 대구은행)', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행',
  'KDB산업은행', '수협은행', '새마을금고', '신협', '우체국예금'
];
const BROKER_LIST = [
  '한국투자증권', '미래에셋증권', '삼성증권', 'NH투자증권', 'KB증권', '신한투자증권',
  '키움증권', '하나증권', '대신증권', '유안타증권', '유진투자증권', '메리츠증권',
  'IBK투자증권', 'SK증권', '한화투자증권', 'DB금융투자', '부국증권', '상상인증권',
  '토스증권', '카카오페이증권', '신영증권', 'iM증권(구 하이투자증권)', '교보증권', '현대차증권'
];
const STOCK_SUGGESTIONS = [
  'SCHD (미국 배당 ETF)', 'JEPI (미국 커버드콜 ETF)', 'JEPQ (미국 커버드콜 ETF)',
  'QQQ (나스닥100 ETF)', 'VOO (S&P500 ETF)', 'VTI (미국 전체시장 ETF)',
  'TIGER 미국배당다우존스', 'KODEX 200', '삼성전자', 'SK하이닉스', 'NAVER', '카카오',
  '현대차', 'LG에너지솔루션', 'POSCO홀딩스', 'Apple', 'Microsoft', 'Tesla', 'Amazon', 'Alphabet(Google)'
];
const KIND_LABEL = { cash: '입출금 (현금)', saving: '적금', deposit: '예금', sub: '청약' };
const ACCOUNT_ICON = {
  cash: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke="#B4A896" stroke-width="1.3"/><circle cx="12" cy="12" r="2.5" stroke="#D9A84E" stroke-width="1.3"/></svg>',
  saving: '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6.5" rx="7" ry="2.5" stroke="#D9A84E" stroke-width="1.3"/><path d="M5 6.5v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" stroke="#B4A896" stroke-width="1.3"/><path d="M5 11.5v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" stroke="#B4A896" stroke-width="1.3"/></svg>',
  deposit: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="1.5" stroke="#B4A896" stroke-width="1.3"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#B4A896" stroke-width="1.3"/><circle cx="12" cy="15" r="1.3" fill="#D9A84E"/></svg>',
  sub: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12l8-7 8 7" stroke="#B4A896" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5v8.5h12v-8.5" stroke="#B4A896" stroke-width="1.3"/><rect x="10" y="14" width="4" height="5" stroke="#D9A84E" stroke-width="1.3"/></svg>'
};
const FREQ_LABEL = { lump: '거치식', monthly: '매월납입', weekly: '매주납입', daily: '매일납입' };
const FREQ_DAYS = { monthly: 30.4368, weekly: 7, daily: 1 };
const DIV_FREQ = {
  monthly: { label: '매월', intervalMonths: 1 },
  quarterly: { label: '분기', intervalMonths: 3 },
  semiannual: { label: '반기', intervalMonths: 6 },
  annual: { label: '연 1회', intervalMonths: 12 }
};

// ---- State ----
let uid = null;
let accounts = [];
let holdings = [];
let settings = { monthlyIncomeGoal: 5000000, plannedYieldPct: 4 };
let unsubAccounts = null;
let unsubHoldings = null;
let unsubSettings = null;
let currentTab = 'dashboard';
let sheetMode = 'account'; // 'account' | 'stock'
let editingId = null;
let usdToKrw = null;
let lastMonthSnapshot = null;
let lastYearSnapshot = null;
let snapshotSavedToday = false;
let snapshotsLoaded = false;

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---- Institution dropdown (은행/증권사 통합) ----
function fillSelect(selectEl, items) {
  selectEl.innerHTML = items.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')
    + `<option value="${OTHER}">기타 (직접 입력)</option>`;
}
$('stock-name-list').innerHTML = STOCK_SUGGESTIONS.map(v => `<option value="${escapeHtml(v)}">`).join('');

$('f-institution').addEventListener('change', () => {
  $('f-institution-other-field').classList.toggle('hidden', $('f-institution').value !== OTHER);
});

function setInstitutionValue(value, list) {
  if (!value) { $('f-institution-other-field').classList.add('hidden'); return; }
  if (list.includes(value)) {
    $('f-institution').value = value;
    $('f-institution-other-field').classList.add('hidden');
  } else {
    $('f-institution').value = OTHER;
    $('f-institution-other-field').classList.remove('hidden');
    $('f-institution-other').value = value;
  }
}
function resolveInstitution() {
  return $('f-institution').value === OTHER ? $('f-institution-other').value.trim() : $('f-institution').value;
}

// ---- FX (USD/KRW, 무료 공개 API·키 불필요) ----
async function fetchFxRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data && data.result === 'success' && data.rates && data.rates.KRW) {
      usdToKrw = data.rates.KRW;
    } else {
      throw new Error('bad fx response');
    }
  } catch (err) {
    console.error('FX fetch failed', err);
  } finally {
    renderStocks();
    renderAssets();
    renderDashboard();
  }
}
fetchFxRate();
setInterval(fetchFxRate, 5 * 60 * 1000);
function fxRate(currency) { return currency === 'USD' ? (usdToKrw || 1400) : 1; }

// ---- 자산·배당 이력 스냅샷 (전달/전년 대비 비교용) ----
// 매일 하루 한 번, 그날의 총자산·이번달 배당·이자를 users/{uid}/history/{YYYY-MM-DD} 문서로 저장해서
// 시간이 지나면서 실제 기록이 쌓이게 한다. 스냅샷이 아직 없는 과거 시점은 비교를 건너뛴다.
function dateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
async function maybeSaveTodaySnapshot(totalAssets, monthlyIncome) {
  if (snapshotSavedToday || !uid) return;
  snapshotSavedToday = true;
  try {
    await setDoc(doc(db, 'users', uid, 'history', dateStr(new Date())), {
      totalAssets, monthlyIncome, savedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) { console.error('snapshot save failed', err); }
}
async function fetchClosestSnapshot(onOrBeforeDate) {
  try {
    const q = query(
      collection(db, 'users', uid, 'history'),
      where(documentId(), '<=', dateStr(onOrBeforeDate)),
      orderBy(documentId(), 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  } catch (err) { console.error('snapshot fetch failed', err); return null; }
}
async function loadComparisonSnapshots() {
  if (snapshotsLoaded) return;
  snapshotsLoaded = true;
  const today = new Date();
  const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  [lastMonthSnapshot, lastYearSnapshot] = await Promise.all([
    fetchClosestSnapshot(oneMonthAgo),
    fetchClosestSnapshot(oneYearAgo)
  ]);
  renderDashboard();
  renderAssets();
}
function formatDeltaSpan(current, past) {
  // 비교할 과거 기록이 아직 없으면(첫 달/첫 해) 계산하지 않고 중립적으로 +0을 보여준다.
  if (past == null) return '<span class="pct-up">+0원 (+0%)</span>';
  const diff = current - past;
  const pct = past ? (diff / Math.abs(past) * 100) : 0;
  const cls = diff >= 0 ? 'pct-up' : 'pct-down';
  const sign = diff >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${formatPlain(diff)}원 (${sign}${pct.toFixed(1)}%)</span>`;
}
function compareLineHtml(current, monthAgo, yearAgo) {
  const m = formatDeltaSpan(current, monthAgo);
  const y = formatDeltaSpan(current, yearAgo);
  return `전달 대비 ${m} · 전년 대비 ${y}`;
}

// ---- Auth ----
// 사파리/인앱 브라우저(카카오톡, 인스타그램 등)에서는 팝업 로그인이 저장소 제한으로
// "missing initial state" 에러를 내며 실패하는 경우가 많아, 실패 시 리다이렉트 방식으로 전환한다.
$('btn-google-login').addEventListener('click', async () => {
  $('login-error').textContent = '';
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    console.error('popup sign-in failed, falling back to redirect', err);
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (err2) {
      $('login-error').textContent = '로그인에 실패했어요. 카카오톡 등 인앱 브라우저라면 Safari나 Chrome으로 열어서 다시 시도해주세요.';
      console.error(err2);
    }
  }
});

getRedirectResult(auth).catch((err) => {
  console.error('redirect sign-in failed', err);
  $('login-error').textContent = '로그인에 실패했어요. 카카오톡 등 인앱 브라우저라면 Safari나 Chrome으로 열어서 다시 시도해주세요.';
});

$('btn-logout').addEventListener('click', async () => {
  await signOut(auth);
  closeSettings();
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    $('login-screen').classList.add('hidden');
    $('app-root').classList.remove('hidden');
    subscribeAll();
  } else {
    uid = null;
    $('login-screen').classList.remove('hidden');
    $('app-root').classList.add('hidden');
    unsubscribeAll();
    accounts = [];
    holdings = [];
  }
});

// order 필드가 없는 기존 문서도 안전하게 섞이도록, 정렬은 Firestore가 아니라 클라이언트에서 처리한다.
// (order로 orderBy()를 걸면 그 필드가 없는 문서는 결과에서 통째로 빠지는 Firestore 특성 때문)
function sortByOrder(list) {
  return list.slice().sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}

function subscribeAll() {
  const accountsQ = query(collection(db, 'users', uid, 'accounts'), orderBy('createdAt', 'desc'));
  unsubAccounts = onSnapshot(accountsQ, (snap) => {
    accounts = sortByOrder(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    renderAssets();
    renderDashboard();
  });

  const holdingsQ = query(collection(db, 'users', uid, 'holdings'), orderBy('createdAt', 'desc'));
  unsubHoldings = onSnapshot(holdingsQ, (snap) => {
    holdings = sortByOrder(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    renderStocks();
    renderAssets();
    renderDashboard();
  });

  const settingsRef = doc(db, 'users', uid, 'meta', 'settings');
  unsubSettings = onSnapshot(settingsRef, (snap) => {
    if (snap.exists()) {
      settings = { ...settings, ...snap.data() };
    }
    fillSettingsForm();
    renderDashboard();
  });

  loadComparisonSnapshots();
}

// 손으로 끌어서 순서 바꾸기 (iOS 스타일). 컨테이너마다 Sortable 인스턴스를 두고,
// 매 렌더링마다 destroy 후 다시 만들어서 innerHTML 교체와 어긋나지 않게 한다.
const sortableInstances = {};
function makeSortable(containerId, collectionName) {
  if (sortableInstances[containerId]) sortableInstances[containerId].destroy();
  const el = $(containerId);
  if (!el) return;
  sortableInstances[containerId] = new Sortable(el, {
    handle: '.drag-handle',
    animation: 150,
    delay: 80,
    delayOnTouchOnly: true,
    onEnd: async () => {
      const ids = Array.from(el.children).map(child => child.dataset.id).filter(Boolean);
      const batch = writeBatch(db);
      ids.forEach((docId, i) => batch.update(doc(db, 'users', uid, collectionName, docId), { order: i }));
      await batch.commit();
    }
  });
}

function unsubscribeAll() {
  if (unsubAccounts) unsubAccounts();
  if (unsubHoldings) unsubHoldings();
  if (unsubSettings) unsubSettings();
  unsubAccounts = unsubHoldings = unsubSettings = null;
}

// ---- Tabs ----
document.querySelectorAll('nav.tabbar button').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.view, btn));
});

function switchTab(name, btn) {
  currentTab = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + name).classList.add('active');
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ---- Formatting helpers ----
function formatWon(n) {
  return '₩' + Math.round(n || 0).toLocaleString('ko-KR');
}
function formatPlain(n) {
  return Math.round(n || 0).toLocaleString('ko-KR');
}
function formatEok(n) {
  const eok = (n || 0) / 100000000;
  const rounded = Math.round(eok * 10) / 10;
  return (Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)) + '억';
}
function formatKoreanUnit(n) {
  n = Math.round(n || 0);
  if (!n) return '0원';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  if (!eok && !man) return sign + formatPlain(n) + '원';
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${formatPlain(man)}만`);
  return sign + parts.join(' ') + '원';
}
function formatPrice(value, currency) {
  return currency === 'USD'
    ? '$' + (value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : formatPlain(value) + '원';
}
// 소수점 주식(예: 0.2537주) 대응 — 최대 4자리까지 보여주고 불필요한 0은 잘라낸다.
function formatShares(n) {
  n = Number(n) || 0;
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}
// 폼 재입력용 — formatPlain과 달리 반올림하지 않고 소수점을 그대로 보존한다.
// (수정 화면 다시 열 때 formatPlain을 쓰면 78.2 같은 소수점이 반올림되어 사라지는 버그가 있었음)
function formatInputNumber(n) {
  if (n === undefined || n === null || n === '') return '';
  const num = Number(n);
  if (!num) return '';
  const [intPart, decPart] = String(num).split('.');
  const formattedInt = Number(intPart).toLocaleString('ko-KR');
  return decPart ? `${formattedInt}.${decPart}` : formattedInt;
}
function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day} (${days[d.getDay()]})`;
}
$('today-label').textContent = todayLabel();

// ---- Thousands-separator inputs (소수점 하나까지 허용: 외화 센트, 소수점 주식 수량 등) ----
function attachThousandsInput(id, hintId) {
  const el = $(id);
  el.addEventListener('input', () => {
    let raw = el.value.replace(/[^\d.]/g, '');
    const firstDot = raw.indexOf('.');
    if (firstDot !== -1) {
      raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
    }
    if (!raw || raw === '.') {
      el.value = raw;
      if (hintId) $(hintId).textContent = '';
      return;
    }
    const [intPart, decPart] = raw.split('.');
    const formattedInt = intPart ? Number(intPart).toLocaleString('ko-KR') : '0';
    el.value = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
    if (hintId) $(hintId).textContent = formatKoreanUnit(Number(raw));
  });
}
function numericValue(id) {
  const raw = $(id).value.replace(/[^\d.]/g, '');
  return raw ? Number(raw) : 0;
}
[
  'f-balance:f-balance-hint', 'f-amount:f-amount-hint', 'f-sub-paid:f-sub-paid-hint', 'f-stock-avg:', 'f-stock-price:', 'f-stock-shares:',
  's-income-goal:s-income-goal-hint'
].forEach(pair => {
  const [id, hintId] = pair.split(':');
  attachThousandsInput(id, hintId || null);
});

// ---- Interest calc (거치식/적립식 공용) ----
function computeInterest(amount, ratePct, startDate, endDate, freq = 'lump', today = new Date()) {
  if (!amount || !ratePct || !startDate) {
    return { netInterestToDate: 0, netTotal: amount || 0, monthlyNetInterest: 0, principalPaidToDate: 0 };
  }
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const rawDaysElapsed = (today - start) / 86400000;
  const daysElapsed = Math.max(0, rawDaysElapsed);
  const totalDays = end ? Math.max(1, (end - start) / 86400000) : null;

  if (freq === 'lump' || !FREQ_DAYS[freq]) {
    const netInterestToDate = Math.round(amount * (ratePct / 100) * (daysElapsed / 365));
    let netTotal = amount + netInterestToDate;
    if (totalDays) {
      const grossFull = amount * (ratePct / 100) * (totalDays / 365);
      netTotal = Math.round(amount + grossFull);
    }
    const monthlyNetInterest = start <= today ? Math.round(amount * (ratePct / 100) / 12) : 0;
    return { netInterestToDate, netTotal, monthlyNetInterest, principalPaidToDate: amount };
  }

  // 적립식 (매월/매주/매일 납입) — 회차별로 발생일 기준 단리 이자를 합산
  const step = FREQ_DAYS[freq];
  const totalPeriods = totalDays ? Math.max(1, Math.round(totalDays / step)) : null;
  const elapsedPeriods = rawDaysElapsed >= 0 ? Math.floor(daysElapsed / step) + 1 : 0;
  const kToDate = totalPeriods ? Math.min(elapsedPeriods, totalPeriods) : elapsedPeriods;

  let grossToDate = 0;
  for (let i = 0; i < kToDate; i++) {
    const daysForThis = Math.max(0, daysElapsed - i * step);
    grossToDate += amount * (ratePct / 100) * (daysForThis / 365);
  }
  const netInterestToDate = Math.round(grossToDate);
  const principalPaidToDate = kToDate * amount;

  let netTotal = principalPaidToDate + netInterestToDate;
  if (totalPeriods) {
    let grossFull = 0;
    for (let i = 0; i < totalPeriods; i++) {
      const daysForThis = Math.max(0, totalDays - i * step);
      grossFull += amount * (ratePct / 100) * (daysForThis / 365);
    }
    netTotal = Math.round(totalPeriods * amount + grossFull);
  }

  const monthlyNetInterest = Math.round(principalPaidToDate * (ratePct / 100) / 12);
  return { netInterestToDate, netTotal, monthlyNetInterest, principalPaidToDate };
}

// 주택청약종합저축은 은행이 금리를 정하지 않고 국토교통부 고시 예치기간별 차등금리가 적용된다.
// (2026.03.18 기준: 1개월 미만 0% · 1년 미만 2.3% · 2년 미만 2.8% · 2년 이상 3.1%, 세전, 변동금리)
// 가입 전 이미 납입해온 금액, 중간에 바뀐 월납입액까지 정확히 재구성할 방법이 없으므로,
// "현재까지 납입 총액"은 사용자가 실제 통장 잔액을 보고 직접 입력하는 값으로 삼고,
// 앱은 거기에 가입일 기준 예치기간으로 정해지는 현재 적용금리로 "이번 달 이자"만 추정해서 더한다.
function subscriptionTierRate(monthsElapsed) {
  if (monthsElapsed < 1) return 0;
  if (monthsElapsed < 12) return 2.3;
  if (monthsElapsed < 24) return 2.8;
  return 3.1;
}
function subscriptionStatus(startDate, today = new Date()) {
  if (!startDate) return { monthsElapsed: 0, roundCount: 0, currentTierRate: 0 };
  const start = new Date(startDate);
  const step = FREQ_DAYS.monthly;
  const rawDaysElapsed = (today - start) / 86400000;
  const monthsElapsed = Math.max(0, rawDaysElapsed / step);
  const roundCount = rawDaysElapsed >= 0 ? Math.floor(monthsElapsed) + 1 : 0;
  return { monthsElapsed, roundCount, currentTierRate: subscriptionTierRate(monthsElapsed) };
}
function subscriptionMonthlyInterest(a) {
  const { currentTierRate } = subscriptionStatus(a.startDate);
  return Math.round((a.currentPaid || 0) * (currentTierRate / 100) / 12);
}

// 원금/잔액 자체를 먼저 원화로 환산한 뒤 계산하는 방식이라, 이자율(%) 계산은 통화와 무관하게 그대로 적용된다.
function accountCurrentValue(a) {
  if (a.kind === 'cash') return (a.balance || 0) * fxRate(a.currency);
  if (a.kind === 'sub') return a.currentPaid || 0;
  const { netInterestToDate, principalPaidToDate } = computeInterest(a.amount, a.ratePct, a.startDate, a.endDate, a.freq || 'lump');
  return ((principalPaidToDate || 0) + netInterestToDate) * fxRate(a.currency);
}

function accountMonthlyInterest(a) {
  if (a.kind === 'cash') return 0;
  if (a.kind === 'sub') return subscriptionMonthlyInterest(a);
  return computeInterest(a.amount, a.ratePct, a.startDate, a.endDate, a.freq || 'lump').monthlyNetInterest * fxRate(a.currency);
}

function holdingCurrentPrice(h) { return h.currentPrice || h.avgPrice || 0; }
function holdingValueKRW(h) { return (h.shares || 0) * holdingCurrentPrice(h) * fxRate(h.currency); }
function holdingCostKRW(h) { return (h.shares || 0) * (h.avgPrice || 0) * fxRate(h.currency); }
function holdingGainKRW(h) { return holdingValueKRW(h) - holdingCostKRW(h); }
function holdingGainPct(h) { const cost = holdingCostKRW(h); return cost ? (holdingGainKRW(h) / cost * 100) : 0; }
// 배당은 매달 균등하게 들어오지 않으므로(분기/반기/연 지급 등), 배당 주기·지급월을 기준으로
// "이번 달에 실제로 들어올 것으로 예상되는 금액"을 계산한다. 지급월이 아니면 0.
function isDividendPayingThisMonth(h, today = new Date()) {
  const freq = DIV_FREQ[h.dividendFreq] ? h.dividendFreq : 'monthly';
  const interval = DIV_FREQ[freq].intervalMonths;
  if (interval === 1) return true;
  const anchor = h.dividendMonth || 12;
  const currentMonth = today.getMonth() + 1;
  return ((currentMonth - anchor) % interval + interval) % interval === 0;
}
// 미국 상장 종목 배당은 한미 조세조약에 따라 원천에서 15% 미국 원천징수가 이미 빠진 채로 입금된다.
// (한국 이자소득세 15.4%와는 다른 세율이라 구분해서 적용 — 국내 종목/이자는 세전 그대로 유지)
function holdingMonthlyDividend(h) {
  if (!isDividendPayingThisMonth(h)) return 0;
  const freq = DIV_FREQ[h.dividendFreq] ? h.dividendFreq : 'monthly';
  const paymentsPerYear = 12 / DIV_FREQ[freq].intervalMonths;
  const usWithholding = h.currency === 'USD' ? 0.85 : 1;
  const annualDividend = holdingValueKRW(h) * (h.dividendYieldPct || 0) / 100 * usWithholding;
  return Math.round(annualDividend / paymentsPerYear);
}

// ---- Render: dashboard ----
function renderDashboard() {
  const accountsTotal = accounts.reduce((sum, a) => sum + accountCurrentValue(a), 0);
  const stocksTotal = holdings.reduce((sum, h) => sum + holdingValueKRW(h), 0);
  const totalAssets = accountsTotal + stocksTotal;

  const monthlyInterest = accounts.reduce((sum, a) => sum + accountMonthlyInterest(a), 0);
  const monthlyDividend = holdings.reduce((sum, h) => sum + holdingMonthlyDividend(h), 0);
  const monthlyIncome = monthlyInterest + monthlyDividend;

  $('total-assets').textContent = displayCurrency === 'USD' ? formatByDisplayCurrency(totalAssets) : formatWon(totalAssets);
  $('total-assets-hint').textContent = displayCurrency === 'USD' ? '' : `(${formatKoreanUnit(totalAssets)})`;
  $('monthly-income').textContent = displayCurrency === 'USD' ? formatByDisplayCurrency(monthlyIncome) : formatWon(monthlyIncome);
  $('monthly-income-hint').textContent = displayCurrency === 'USD' ? '' : `(${formatKoreanUnit(monthlyIncome)})`;
  $('monthly-income-detail').textContent = displayCurrency === 'USD'
    ? `이자 ${formatByDisplayCurrency(monthlyInterest)} · 배당 ${formatByDisplayCurrency(monthlyDividend)}`
    : `이자 ${formatPlain(monthlyInterest)}원 · 배당 ${formatPlain(monthlyDividend)}원`;
  $('total-assets-compare').innerHTML = compareLineHtml(totalAssets, lastMonthSnapshot?.totalAssets, lastYearSnapshot?.totalAssets);
  $('monthly-income-compare').innerHTML = compareLineHtml(monthlyIncome, lastMonthSnapshot?.monthlyIncome, lastYearSnapshot?.monthlyIncome);
  maybeSaveTodaySnapshot(totalAssets, monthlyIncome);

  const incomeGoal = settings.monthlyIncomeGoal || 1;
  const incomePct = Math.min(100, (monthlyIncome / incomeGoal) * 100);
  $('income-progress-fill').style.width = incomePct.toFixed(1) + '%';
  $('income-progress-label').textContent = `월 목표의 ${Math.round(incomePct)}%`;

  const yieldPct = settings.plannedYieldPct || 4;
  const fireTarget = yieldPct > 0 ? (incomeGoal * 12) / (yieldPct / 100) : 0;
  const firePct = fireTarget ? Math.min(100, (totalAssets / fireTarget) * 100) : 0;
  $('fire-target-label').textContent = `목표자산 약 ${formatEok(fireTarget)}`;
  $('fire-progress-fill').style.width = firePct.toFixed(1) + '%';
  $('fire-progress-label').textContent = `${Math.round(firePct)}%`;
  $('fire-assumption').textContent = `예상 연 배당률 ${yieldPct}% 가정 · 세전 기준 역산`;
}

// ---- Render: assets ----
function renderAssets() {
  const accountsTotal = accounts.reduce((sum, a) => sum + accountCurrentValue(a), 0);
  const stocksTotal = holdings.reduce((sum, h) => sum + holdingValueKRW(h), 0);
  $('assets-accounts-total').textContent = formatByDisplayCurrency(accountsTotal);
  $('assets-stocks-total').textContent = formatByDisplayCurrency(stocksTotal);
  $('assets-grand-total').textContent = formatByDisplayCurrency(accountsTotal + stocksTotal);
  $('assets-grand-total-compare').innerHTML = compareLineHtml(accountsTotal + stocksTotal, lastMonthSnapshot?.totalAssets, lastYearSnapshot?.totalAssets);
  renderHoldingList('assets-stocks-list', 'assets', displayCurrency);

  const list = $('assets-list');
  if (accounts.length === 0) {
    if (sortableInstances['assets-list']) { sortableInstances['assets-list'].destroy(); delete sortableInstances['assets-list']; }
    list.innerHTML = '<div class="empty-state">아직 등록된 계좌가 없어요. 오른쪽 아래 + 버튼으로 추가해보세요.</div>';
    return;
  }
  list.innerHTML = accounts.map((a) => {
    const value = accountCurrentValue(a);
    const isUsd = a.currency === 'USD';
    const currencyRow = isUsd ? `<div class="kv"><span>통화</span><span>USD (실시간 환율로 원화 환산)</span></div>` : '';
    let detail;
    let box;
    if (a.kind === 'cash') {
      detail = `${a.bank || ''}${isUsd ? ' · 달러' : ''}`;
      box = `<div class="kv"><span>계좌 종류</span><span>${KIND_LABEL[a.kind]}</span></div>
             <div class="kv"><span>잔액(원래 통화)</span><span>${formatPrice(a.balance, a.currency)}</span></div>
             ${currencyRow}`;
    } else if (a.kind === 'sub') {
      const { roundCount, currentTierRate } = subscriptionStatus(a.startDate);
      const monthlyInterest = subscriptionMonthlyInterest(a);
      detail = `${a.bank || ''} · 현재 적용금리 ${currentTierRate}% · 약 ${roundCount}회차`;
      box = `<div class="kv"><span>현재까지 납입 총액</span><span>${formatPlain(a.currentPaid || 0)}원</span></div>
             <div class="kv"><span>이번 달 예상 이자(세전)</span><span>${formatPlain(monthlyInterest)}원</span></div>
             <div class="kv"><span>현재 적용금리(세전)</span><span>${currentTierRate}%</span></div>
             <div class="kv"><span>가입 후 경과</span><span>약 ${roundCount}회차</span></div>
             ${a.amount ? `<div class="kv"><span>월 납입액(참고)</span><span>${formatPlain(a.amount)}원</span></div>` : ''}
             <div class="kv"><span>가입일</span><span>${a.startDate || '-'}</span></div>`;
    } else {
      detail = `${a.bank || ''}${a.ratePct ? ' · ' + a.ratePct + '%' : ''}${a.freq ? ' · ' + FREQ_LABEL[a.freq] : ''}${isUsd ? ' · 달러' : ''}`;
      const { netInterestToDate } = computeInterest(a.amount, a.ratePct, a.startDate, a.endDate, a.freq || 'lump');
      box = `<div class="kv"><span>납입 방식</span><span>${FREQ_LABEL[a.freq || 'lump']}</span></div>
             <div class="kv"><span>원금(원래 통화)</span><span>${formatPrice(a.amount, a.currency)}</span></div>
             <div class="kv"><span>오늘까지 누적 이자(세전, 원화 환산)</span><span>${formatPlain(netInterestToDate * (isUsd ? fxRate('USD') : 1))}원</span></div>
             <div class="kv"><span>가입일 ~ 만기일</span><span>${a.startDate || '-'} ~ ${a.endDate || '-'}</span></div>
             ${currencyRow}`;
    }
    return `
      <div class="ledger-item" data-id="${a.id}">
        <div class="ledger-row" data-toggle="a-${a.id}">
          <div class="row-icon">${ACCOUNT_ICON[a.kind] || ACCOUNT_ICON.cash}</div>
          <div class="ledger-mid">
            <p class="ledger-name">${escapeHtml(a.nickname || KIND_LABEL[a.kind])}</p>
            <p class="ledger-detail">${escapeHtml(detail)}</p>
          </div>
          <div class="ledger-amount">${formatByDisplayCurrency(value)}</div>
          <div class="drag-handle">⠿</div>
        </div>
        <div class="ledger-detailbox" id="a-${a.id}">
          ${box}
          <div class="row-actions">
            <button class="row-edit" data-edit-account="${a.id}">수정</button>
            <button class="row-delete" data-delete-account="${a.id}">삭제</button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-toggle]').forEach(row => {
    row.addEventListener('click', (e) => { if (e.target.closest('.drag-handle')) return; $(row.dataset.toggle).classList.toggle('open'); });
  });
  list.querySelectorAll('[data-delete-account]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteDoc(doc(db, 'users', uid, 'accounts', btn.dataset.deleteAccount));
    });
  });
  list.querySelectorAll('[data-edit-account]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const acc = accounts.find(a => a.id === btn.dataset.editAccount);
      if (acc) openSheet('account', acc);
    });
  });
  makeSortable('assets-list', 'accounts');
}

// ---- 원/USD 전체 표시 통화 토글 (대시보드·보유자산·주식 탭 공용) ----
let displayCurrency = 'KRW';
document.querySelectorAll('.js-currency-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    displayCurrency = btn.dataset.currency;
    document.querySelectorAll('.js-currency-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.currency === displayCurrency);
    });
    renderDashboard();
    renderAssets();
    renderStocks();
  });
});
function formatByDisplayCurrency(krwValue, currency = displayCurrency) {
  if (currency === 'USD') {
    const usd = krwValue / fxRate('USD');
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return formatPlain(krwValue) + '원';
}

// ---- Render: stocks ----
let stockSort = 'manual';
$('stock-sort-select').addEventListener('change', () => {
  stockSort = $('stock-sort-select').value;
  renderStocks();
});
function sortedHoldings() {
  const list = holdings.slice();
  switch (stockSort) {
    case 'yield-desc': return list.sort((a, b) => holdingGainPct(b) - holdingGainPct(a));
    case 'yield-asc': return list.sort((a, b) => holdingGainPct(a) - holdingGainPct(b));
    case 'value-desc': return list.sort((a, b) => holdingValueKRW(b) - holdingValueKRW(a));
    case 'value-asc': return list.sort((a, b) => holdingValueKRW(a) - holdingValueKRW(b));
    case 'name': return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    case 'broker': return list.sort((a, b) => (a.broker || '').localeCompare(b.broker || '', 'ko'));
    default: return list;
  }
}

function renderStocks() {
  const total = holdings.reduce((sum, h) => sum + holdingValueKRW(h), 0);
  const cost = holdings.reduce((sum, h) => sum + holdingCostKRW(h), 0);
  const dividend = holdings.reduce((sum, h) => sum + holdingMonthlyDividend(h), 0);
  const gain = total - cost;
  const gainPct = cost ? (gain / cost * 100) : 0;

  $('stock-total').textContent = formatByDisplayCurrency(total);
  $('stock-dividend').textContent = formatByDisplayCurrency(dividend);
  const gainEl = $('stock-gain-summary');
  gainEl.textContent = `${gain >= 0 ? '+' : ''}${formatByDisplayCurrency(gain)} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)`;
  gainEl.className = 'cell-sub ' + (gain >= 0 ? 'pct-up' : 'pct-down');

  renderHoldingList('stocks-list', 'stocks', displayCurrency, sortedHoldings(), stockSort === 'manual');
}

// 주식 탭과 보유자산 탭 양쪽에서 재사용하는 종목 리스트 렌더러 (컨테이너별로 detail box id를 분리)
function renderHoldingList(containerId, prefix, displayCurrency = 'KRW', list_ = holdings, sortable = true) {
  const list = $(containerId);
  if (holdings.length === 0) {
    if (sortableInstances[containerId]) { sortableInstances[containerId].destroy(); delete sortableInstances[containerId]; }
    list.innerHTML = '<div class="empty-state">아직 등록된 종목이 없어요. 주식 탭에서 + 버튼을 눌러 추가해보세요.</div>';
    return;
  }
  list.innerHTML = list_.map((h) => {
    const g = holdingGainKRW(h);
    const gp = holdingGainPct(h);
    const boxId = `${prefix}-h-${h.id}`;
    return `
    <div class="ledger-item" data-id="${h.id}">
      <div class="holding-row" data-toggle="${boxId}">
        <div>
          <p class="holding-name">${escapeHtml(h.name)}</p>
          <p class="holding-detail">${escapeHtml(h.broker || '')}${h.broker ? ' · ' : ''}평단 ${formatPrice(h.avgPrice, h.currency)} · ${formatShares(h.shares)}주 · 배당률 ${h.dividendYieldPct || 0}% (${DIV_FREQ[h.dividendFreq] ? DIV_FREQ[h.dividendFreq].label : '매월'})</p>
        </div>
        <div>
          <div class="holding-amount">${formatByDisplayCurrency(holdingValueKRW(h), displayCurrency)}</div>
          <div class="holding-yield ${g >= 0 ? 'pct-up' : 'pct-down'}">${g >= 0 ? '+' : ''}${formatByDisplayCurrency(g, displayCurrency)} (${gp >= 0 ? '+' : ''}${gp.toFixed(1)}%)</div>
        </div>
        ${sortable ? '<div class="drag-handle">⠿</div>' : ''}
      </div>
      <div class="ledger-detailbox" id="${boxId}">
        <div class="kv"><span>현재가</span><span>${formatPrice(holdingCurrentPrice(h), h.currency)}</span></div>
        <div class="row-actions">
          <button class="row-edit" data-edit-holding="${h.id}">수정</button>
          <button class="row-delete" data-delete-holding="${h.id}">삭제</button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  list.querySelectorAll('[data-toggle]').forEach(row => {
    row.addEventListener('click', (e) => { if (e.target.closest('.drag-handle')) return; $(row.dataset.toggle).classList.toggle('open'); });
  });
  list.querySelectorAll('[data-delete-holding]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteDoc(doc(db, 'users', uid, 'holdings', btn.dataset.deleteHolding));
    });
  });
  if (sortable) {
    makeSortable(containerId, 'holdings');
  } else if (sortableInstances[containerId]) {
    sortableInstances[containerId].destroy();
    delete sortableInstances[containerId];
  }
  list.querySelectorAll('[data-edit-holding]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const h = holdings.find(x => x.id === btn.dataset.editHolding);
      if (h) openSheet('stock', h);
    });
  });
}

// ---- Add/Edit sheet ----
const sheetBackdrop = $('sheet-backdrop');
$('btn-fab').addEventListener('click', () => openSheet(currentTab === 'stocks' ? 'stock' : 'account', null));
$('btn-sheet-close').addEventListener('click', closeSheet);

function openSheet(mode, editRecord) {
  sheetMode = mode;
  editingId = editRecord ? editRecord.id : null;
  $('form-error').textContent = '';
  $('account-form').reset();
  $('f-institution-other-field').classList.add('hidden');

  if (mode === 'stock') {
    $('institution-label').textContent = '증권사';
    fillSelect($('f-institution'), BROKER_LIST);
    $('accountOnlyFields').classList.add('hidden');
    $('stockFields').classList.remove('hidden');
    $('sheet-title').textContent = editingId ? '종목 수정' : '종목 등록';
    $('sheet-hint').textContent = editingId ? '종목 정보를 수정해요' : '보유 중인 종목을 등록하면 대시보드에 자동 반영돼요';
    if (editRecord) {
      setInstitutionValue(editRecord.broker || '', BROKER_LIST);
      $('f-stock-name').value = editRecord.name || '';
      $('f-stock-currency').value = editRecord.currency || 'KRW';
      $('f-stock-shares').value = editRecord.shares ? formatInputNumber(editRecord.shares) : '';
      $('f-stock-avg').value = editRecord.avgPrice ? formatInputNumber(editRecord.avgPrice) : '';
      $('f-stock-price').value = editRecord.currentPrice ? formatInputNumber(editRecord.currentPrice) : '';
      $('f-stock-yield').value = editRecord.dividendYieldPct || '';
      $('f-stock-divfreq').value = editRecord.dividendFreq || 'monthly';
      $('f-stock-divmonth').value = editRecord.dividendMonth || '12';
    }
    toggleDivMonthField();
  } else {
    $('institution-label').textContent = '은행';
    fillSelect($('f-institution'), BANK_LIST);
    $('accountOnlyFields').classList.remove('hidden');
    $('stockFields').classList.add('hidden');
    $('sheet-title').textContent = editingId ? '계좌 수정' : '계좌 등록';
    $('sheet-hint').textContent = editingId ? '계좌 정보를 수정해요' : '한 번만 입력하면 그 다음부터는 자동으로 계산돼요';
    if (editRecord) { $('f-kind').value = editRecord.kind; }
    toggleAccountFields();
    if (editRecord) {
      setInstitutionValue(editRecord.bank || '', BANK_LIST);
      $('f-nickname').value = editRecord.nickname || '';
      $('f-account-currency').value = editRecord.currency || 'KRW';
      if (editRecord.kind === 'cash') {
        $('f-balance').value = editRecord.balance ? formatInputNumber(editRecord.balance) : '';
      } else if (editRecord.kind === 'sub') {
        $('f-start').value = editRecord.startDate || '';
        $('f-sub-paid').value = editRecord.currentPaid ? formatInputNumber(editRecord.currentPaid) : '';
        $('f-amount').value = editRecord.amount ? formatInputNumber(editRecord.amount) : '';
      } else {
        $('f-freq').value = editRecord.freq || (editRecord.kind === 'deposit' ? 'lump' : 'monthly');
        $('f-amount').value = editRecord.amount ? formatInputNumber(editRecord.amount) : '';
        $('f-rate').value = editRecord.ratePct || '';
        $('f-start').value = editRecord.startDate || '';
        $('f-end').value = editRecord.endDate || '';
      }
    }
    toggleFreqLabel();
  }
  updatePreview();
  $('btn-submit').textContent = editingId ? '수정하기' : '등록하기';
  sheetBackdrop.classList.add('open');
}
function closeSheet() { sheetBackdrop.classList.remove('open'); }

// 계좌 종류별 납입 방식 선택지: 예금=거치식 고정, 적금=적립식만, 청약=매월 고정(정부 고시 금리 자동 적용)
const FREQ_OPTIONS_BY_KIND = {
  deposit: [{ value: 'lump', label: '거치식 (한 번에 넣고 만기까지 보유)' }],
  saving: [
    { value: 'monthly', label: '매월 납입' },
    { value: 'weekly', label: '매주 납입' },
    { value: 'daily', label: '매일 납입' }
  ],
  sub: [{ value: 'monthly', label: '매월 납입' }]
};

$('f-kind').addEventListener('change', () => { toggleAccountFields(); toggleFreqLabel(); updatePreview(); });
function toggleAccountFields() {
  const kind = $('f-kind').value;
  const isSub = kind === 'sub';
  $('accountCurrencyField').classList.toggle('hidden', isSub);
  if (isSub) $('f-account-currency').value = 'KRW';

  if (kind === 'cash') {
    $('cashFields').classList.remove('hidden');
    $('rateFields').classList.add('hidden');
    return;
  }
  $('cashFields').classList.add('hidden');
  $('rateFields').classList.remove('hidden');

  const opts = FREQ_OPTIONS_BY_KIND[kind] || FREQ_OPTIONS_BY_KIND.saving;
  $('f-freq').innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  $('freqField').classList.toggle('hidden', opts.length === 1);
  $('f-freq').value = opts[0].value;

  $('rateField').classList.toggle('hidden', isSub);
  $('endDateField').classList.toggle('hidden', isSub);
  $('subPaidField').classList.toggle('hidden', !isSub);
  $('subRateNote').classList.toggle('hidden', !isSub);
  $('out-interest-label').textContent = isSub ? '이번 달 예상 이자(세전)' : '오늘 기준 누적 이자(세전)';
  $('out-total-label').textContent = isSub ? '가입 후 경과' : '만기 예상 수령액';
}

$('f-stock-divfreq').addEventListener('change', toggleDivMonthField);
function toggleDivMonthField() {
  $('f-stock-divmonth-field').classList.toggle('hidden', $('f-stock-divfreq').value === 'monthly');
}

$('f-freq').addEventListener('change', () => { toggleFreqLabel(); updatePreview(); });
function toggleFreqLabel() {
  const kind = $('f-kind').value;
  if (kind === 'sub') { $('f-amount-label').textContent = '월 납입액 (참고용, 선택)'; return; }
  $('f-amount-label').textContent = $('f-freq').value === 'lump' ? '원금' : '회당 납입액';
}

['f-amount', 'f-rate', 'f-start', 'f-end', 'f-sub-paid'].forEach(id => {
  $(id).addEventListener('input', updatePreview);
});
function updatePreview() {
  const kind = $('f-kind').value;
  const amount = numericValue('f-amount');
  const start = $('f-start').value;

  if (kind === 'sub') {
    const currentPaid = numericValue('f-sub-paid');
    if (!start) { $('out-interest').textContent = '–'; $('out-total').textContent = '–'; return; }
    const { roundCount, currentTierRate } = subscriptionStatus(start);
    $('out-interest').textContent = formatPlain(subscriptionMonthlyInterest({ currentPaid, startDate: start })) + '원';
    $('out-total').textContent = `약 ${roundCount}회차 · 현재 ${currentTierRate}%`;
    return;
  }

  const rate = parseFloat($('f-rate').value) || 0;
  const end = $('f-end').value;
  const freq = $('f-freq').value;
  if (!amount || !rate || !start) {
    $('out-interest').textContent = '–';
    $('out-total').textContent = '–';
    return;
  }
  const { netInterestToDate, netTotal } = computeInterest(amount, rate, start, end, freq);
  $('out-interest').textContent = formatPlain(netInterestToDate) + '원';
  $('out-total').textContent = end ? formatPlain(netTotal) + '원' : '만기일 미입력';
}

$('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('form-error').textContent = '';
  const submitBtn = $('btn-submit');
  submitBtn.disabled = true;
  try {
    if (sheetMode === 'stock') {
      const broker = resolveInstitution();
      const name = $('f-stock-name').value.trim();
      const currency = $('f-stock-currency').value;
      const avgPrice = numericValue('f-stock-avg');
      const currentPrice = numericValue('f-stock-price') || avgPrice;
      const shares = numericValue('f-stock-shares');
      const dividendYieldPct = parseFloat($('f-stock-yield').value) || 0;
      const dividendFreq = $('f-stock-divfreq').value;
      const dividendMonth = dividendFreq === 'monthly' ? null : parseInt($('f-stock-divmonth').value, 10);
      if (!name || !shares) { $('form-error').textContent = '종목명과 수량을 입력해주세요.'; return; }
      const payload = { broker, name, currency, avgPrice, currentPrice, shares, dividendYieldPct, dividendFreq, dividendMonth };
      if (editingId) {
        await updateDoc(doc(db, 'users', uid, 'holdings', editingId), payload);
      } else {
        await addDoc(collection(db, 'users', uid, 'holdings'), { ...payload, order: holdings.length, createdAt: serverTimestamp() });
      }
    } else {
      const kind = $('f-kind').value;
      const bank = resolveInstitution();
      const nickname = $('f-nickname').value.trim();
      const currency = kind === 'sub' ? 'KRW' : $('f-account-currency').value;
      let payload;
      if (kind === 'cash') {
        payload = { kind, bank, nickname, currency, balance: numericValue('f-balance') };
      } else if (kind === 'sub') {
        const currentPaid = numericValue('f-sub-paid');
        const amount = numericValue('f-amount');
        const startDate = $('f-start').value;
        if (!currentPaid || !startDate) { $('form-error').textContent = '현재까지 납입 총액과 가입일을 입력해주세요.'; return; }
        payload = { kind, bank, nickname, currency, currentPaid, amount, startDate };
      } else {
        const freq = $('f-freq').value;
        const amount = numericValue('f-amount');
        const ratePct = parseFloat($('f-rate').value) || 0;
        const startDate = $('f-start').value;
        const endDate = $('f-end').value;
        if (!amount || !ratePct || !startDate) { $('form-error').textContent = '납입액, 금리, 가입일을 입력해주세요.'; return; }
        payload = { kind, bank, nickname, currency, freq, amount, ratePct, startDate, endDate };
      }
      if (editingId) {
        await updateDoc(doc(db, 'users', uid, 'accounts', editingId), payload);
      } else {
        await addDoc(collection(db, 'users', uid, 'accounts'), { ...payload, order: accounts.length, createdAt: serverTimestamp() });
      }
    }
    closeSheet();
  } catch (err) {
    console.error(err);
    $('form-error').textContent = '저장에 실패했어요. 잠시 후 다시 시도해주세요.';
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Settings sheet ----
const settingsBackdrop = $('settings-backdrop');
$('btn-settings').addEventListener('click', () => settingsBackdrop.classList.add('open'));
$('btn-settings-close').addEventListener('click', closeSettings);
function closeSettings() { settingsBackdrop.classList.remove('open'); }

function fillSettingsForm() {
  $('s-income-goal').value = settings.monthlyIncomeGoal ? formatPlain(settings.monthlyIncomeGoal) : '';
  $('s-income-goal-hint').textContent = settings.monthlyIncomeGoal ? formatKoreanUnit(settings.monthlyIncomeGoal) : '';
  $('s-yield').value = settings.plannedYieldPct || '';
  updateComputedFireTarget();
}

function updateComputedFireTarget() {
  const income = numericValue('s-income-goal');
  const yieldPct = parseFloat($('s-yield').value) || 0;
  if (!income || !yieldPct) { $('s-fire-target-computed').textContent = '–'; return; }
  const target = (income * 12) / (yieldPct / 100);
  $('s-fire-target-computed').textContent = `${formatPlain(target)}원 (${formatKoreanUnit(target)})`;
}
$('s-income-goal').addEventListener('input', updateComputedFireTarget);
$('s-yield').addEventListener('input', updateComputedFireTarget);

$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const next = {
    monthlyIncomeGoal: numericValue('s-income-goal'),
    plannedYieldPct: parseFloat($('s-yield').value) || 0
  };
  await setDoc(doc(db, 'users', uid, 'meta', 'settings'), next, { merge: true });
  closeSettings();
});
