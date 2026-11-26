/* =========================================================
   청약딱 — 내 조건 맞춤 청약 필터 (전국판)
   정적 웹앱 (index.html + styles.css + app.js + data/listings.json)
   데이터: 청약홈(applyhome.co.kr) 전국 17개 시도 활성 공고
   ========================================================= */
(function () {
  'use strict';

  /* ───────────────────────── 상수 ───────────────────────── */
  var HOUSING = [
    { v: '무주택', l: '무주택' },
    { v: '1주택', l: '1주택' },
    { v: '2주택+', l: '2주택 이상' }
  ];
  /* 거주지는 광역권 단위로 고른다. 실제 판정은 시도 단위로 한다. */
  var REGIONS = [
    { v: '서울', l: '서울', sidos: ['서울'] },
    { v: '경기', l: '경기', sidos: ['경기'] },
    { v: '인천', l: '인천', sidos: ['인천'] },
    { v: '부산·울산·경남', l: '부산·울산·경남', sidos: ['부산', '울산', '경남'] },
    { v: '대구·경북', l: '대구·경북', sidos: ['대구', '경북'] },
    { v: '대전·세종·충청', l: '대전·세종·충청', sidos: ['대전', '세종', '충북', '충남'] },
    { v: '광주·전라', l: '광주·전라', sidos: ['광주', '전북', '전남'] },
    { v: '강원·제주', l: '강원·제주', sidos: ['강원', '제주'] }
  ];
  var HOUSEHOLDER = [
    { v: '세대주', l: '세대주' },
    { v: '세대원', l: '세대원' }
  ];
  var DEPOSIT_CHIPS = [
    { v: 0, l: '없음' },
    { v: 2000000, l: '200만' },
    { v: 2500000, l: '250만' },
    { v: 3000000, l: '300만' },
    { v: 3500000, l: '350만' },
    { v: 4000000, l: '400만' },
    { v: 4500000, l: '450만' },
    { v: 5000000, l: '500만+' }
  ];
  var DEP_MAX = 15000000;   /* 슬라이더 상한 1,500만 원 */
  var DEP_STEP = 100000;    /* 슬라이더 10만 원 단위 */
  var STORE_KEY = 'cheongyakddak:v3';
  var APPLIED_KEY = 'cheongyakddak:applied:v1';
  var LEGACY_KEY = 'cheongyakddak:v2';
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  /* ── 청약홈 로그인 먼저 하기 ────────────────────────────────
     청약신청 화면(selectSubscrtReqstAptMainView.do 등)에서 '청약신청하기'를 누르면
     청약홈이 로그인 화면을 먼저 보여 주고, 그 로그인 화면의 복귀 주소(nextUrl)는
     서버가 /ap/aph/reqst/selectPblancChoise.do(청약신청 단지 선택)로 고정해 둔다.
     로그인 URL에 returnUrl·nextUrl·redirectUrl 같은 복귀 파라미터를 붙여도 전부 무시돼서
     (2026-11-26 확인) 비로그인 상태로 신청 버튼을 누르면 보던 화면으로 돌아오지 못한다.
     그래서 앱은 로그인을 먼저 마치도록 이 주소를 '로그인 먼저' 링크로 열어 주고,
     로그인을 마치면 청약신청 단지 선택 단계로 들어가 바로 이어서 신청하게 한다. */
  var APPLYHOME_LOGIN_URL = 'https://www.applyhome.co.kr/ap/aph/reqst/selectPblancChoise.do';

  /* ── 청약홈 접수 가능 시간 ────────────────────────────────
     근거: 청약홈 「인터넷 주택청약업무 운영시간」 — 주택청약 접수 09:00~17:30 (영업일).
     입주자모집공고문도 유형(특별공급·1순위·무순위·임의공급·민간임대)과 상관없이
     '청약신청 시간 09:00~17:30'으로 같고, 17:30은 '접수 완료' 기준이라 그 전에
     전자서명까지 끝나야 한다. 주말·공휴일은 접수 없음. 시각은 모두 한국 시간(KST). */
  var APPLY_FROM = 9 * 60;          /* 09:00 — 분 단위 */
  var APPLY_TO = 17 * 60 + 30;      /* 17:30 */
  /* 청약홈이 쉬는 공휴일(주말 제외) — 관공서 공휴일 기준.
     2026년은 확정분, 2027년은 우주항공청 월력요항 기준. 임시공휴일은 반영 전이라
     그날은 평일처럼 열리며, 실제 접수 가능 여부는 청약홈이 최종 판단한다. */
  var HOLIDAYS = {
    '2026-01-01': '신정',
    '2026-02-16': '설 연휴', '2026-02-17': '설날', '2026-02-18': '설 연휴',
    '2026-03-01': '삼일절', '2026-03-02': '삼일절 대체공휴일',
    '2026-05-01': '노동절', '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날', '2026-05-25': '부처님오신날 대체공휴일',
    '2026-06-03': '전국동시지방선거', '2026-06-06': '현충일',
    '2026-07-17': '제헌절',
    '2026-08-15': '광복절', '2026-08-17': '광복절 대체공휴일',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절', '2026-10-05': '개천절 대체공휴일', '2026-10-09': '한글날',
    '2026-12-25': '성탄절',
    '2027-01-01': '신정',
    '2027-02-06': '설 연휴', '2027-02-07': '설날', '2027-02-08': '설 연휴',
    '2027-02-09': '설 연휴 대체공휴일',
    '2027-03-01': '삼일절',
    '2027-05-01': '노동절', '2027-05-03': '노동절 대체공휴일',
    '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
    '2027-06-06': '현충일',
    '2027-07-17': '제헌절', '2027-07-19': '제헌절 대체공휴일',
    '2027-08-15': '광복절', '2027-08-16': '광복절 대체공휴일',
    '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절', '2027-10-04': '개천절 대체공휴일',
    '2027-10-09': '한글날', '2027-10-11': '한글날 대체공휴일',
    '2027-12-25': '성탄절', '2027-12-27': '성탄절 대체공휴일'
  };

  /* ───────────────────────── 상태 ───────────────────────── */
  var state = {
    housing: '무주택',
    residence: '경기',
    deposit: 2000000,          /* 원 단위 */
    householder: '세대주',
    filter: 'eligible',
    sort: 'deadline',
    favs: [],
    applied: {}            /* 관심 공고별 '신청 완료' 체크 시각 */
  };

  var LISTINGS = [];
  var META = {};
  var evalCache = [];
  var lastFocus = null;

  /* ───────────────────────── 유틸 ───────────────────────── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return Number(n).toLocaleString('ko-KR'); }
  /* 금액은 앱 안에서 원 단위로 다룬다. */
  function won(n) { return num(Math.round(n)) + '원'; }
  function moneyLabel(n) {
    n = Math.round(n);
    if (n === 0) return '0원';
    if (n >= 10000 && n % 10000 === 0) return num(n / 10000) + '만 원';
    return num(n) + '원';
  }
  function moneyChip(n) {
    if (!n) return '없음';
    if (n >= 100000000) return num(Math.round(n / 100000000 * 10) / 10) + '억';
    if (n % 10000 === 0) return num(n / 10000) + '만';
    return won(n);
  }
  /* 원 단위 금액을 카드·표에 짧게: 2억 1,550만 / 753만 */
  function wonShort(w) {
    w = Math.round(Number(w) || 0);
    if (w >= 100000000) {
      var eok = Math.floor(w / 100000000);
      var man = Math.round((w % 100000000) / 10000);
      return num(eok) + '억' + (man ? ' ' + num(man) + '만' : '');
    }
    if (w >= 10000) return num(Math.round(w / 10000)) + '만';
    return num(w) + '원';
  }
  /* 공고문 표 단위(천원) → 짧은 금액 */
  function cheonShort(n) { return wonShort((Number(n) || 0) * 1000); }

  function parseWon(s) {
    var digits = String(s == null ? '' : s).replace(/[^0-9]/g, '');
    if (!digits) return 0;
    return Math.min(Number(digits), 999999999);
  }
  /* 접수일·발표일은 'YYYY-MM-DD' 하루 단위 값이라 클라이언트 시간대와 상관없이 UTC 자정으로 다룬다.
     '오늘'은 한국 시간(Asia/Seoul) 기준으로 잡는다 — 접수 시간 안내와 기준이 같아야 한다. */
  function pad2(n) { return ('0' + n).slice(-2); }
  function parseDate(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    return isNaN(d.getTime()) ? null : d;
  }
  /* UTC 필드를 그대로 읽으면 한국 시각이 되는 Date (클라이언트 시간대 무관) */
  function kstWall() { return new Date(Date.now() + 9 * 3600000); }
  function kstIso(w) {
    w = w || kstWall();
    return w.getUTCFullYear() + '-' + pad2(w.getUTCMonth() + 1) + '-' + pad2(w.getUTCDate());
  }
  function startOfToday() {
    var w = kstWall();
    return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
  }
  function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / 86400000); }
  function md(iso) {
    var d = parseDate(iso);
    if (!d) return '미정';
    return (d.getUTCMonth() + 1) + '/' + pad2(d.getUTCDate());
  }
  function mdw(iso) {
    var d = parseDate(iso);
    if (!d) return '미정';
    return md(iso) + '(' + WD[d.getUTCDay()] + ')';
  }
  function mySidos() {
    for (var i = 0; i < REGIONS.length; i++) {
      if (REGIONS[i].v === state.residence) return REGIONS[i].sidos;
    }
    return [];
  }
  function cross(a, b) {
    var out = [];
    (a || []).forEach(function (x) { if ((b || []).indexOf(x) !== -1) out.push(x); });
    return out;
  }
  function regionLabel(list) {
    if (!list || !list.length) return '확인 필요';
    if (list.length >= 17) return '전국';
    if (list.length === 3 && list.indexOf('서울') !== -1 && list.indexOf('경기') !== -1 && list.indexOf('인천') !== -1) {
      return '수도권(서울·경기·인천)';
    }
    return list.join('·');
  }

  function statusOf(L) {
    var today = startOfToday();
    var end = parseDate(L.applyEnd);
    var start = parseDate(L.applyStart) || end;
    if (!end) return { key: 'unknown', label: '일정 미확인', days: null };
    if (today > end) return { key: 'closed', label: '접수 마감', days: diffDays(end, today) };
    if (today < start) return { key: 'upcoming', label: 'D-' + diffDays(start, today), days: diffDays(start, today) };
    var left = diffDays(end, today);
    if (left === 0) return { key: 'open', label: '오늘 마감', days: 0, urgent: true };
    return { key: 'open', label: 'D-' + left, days: left, urgent: left <= 2 };
  }

  /* 이미 끝난 공고 — 기본 목록·연속 신청 모드에 올리지 않는다.
     · 접수 기간이 지난 공고(접수 마감)
     · 오늘이 마지막 접수일인데 17:30이 지나(또는 주말·공휴일이라) 오늘 안에 접수할 수 없는 공고
     날짜만 보는 statusOf로는 두 번째 경우를 알 수 없어 접수 시간 게이트를 함께 본다. */
  function isEnded(e) {
    var st = e.status;
    if (st.key === 'closed') return true;
    if (st.key === 'open' && st.days === 0) {
      var r = applyGate().reason;
      return r === 'after' || r === 'weekend' || r === 'holiday';
    }
    return false;
  }

  /* ─────────────────── 청약 접수 시간 게이트 ───────────────────
     접수 기간(접수중)이라도 한국 시간 09:00~17:30 밖이거나 주말·공휴일이면
     실제 신청 화면으로 넘어가지 않게 막고, 언제 열리는지 알려 준다. */
  function minutesText(m) {
    m = Math.max(0, Math.round(m));
    var h = Math.floor(m / 60), mm = m % 60;
    if (h && mm) return h + '시간 ' + mm + '분';
    if (h) return h + '시간';
    return mm + '분';
  }
  function dayLabel(w) {  /* '오늘 11/26' · '내일 11/27' · '월요일 11/30' */
    if (!w) return '';
    var diff = diffDays(w, startOfToday());
    var text = (w.getUTCMonth() + 1) + '/' + pad2(w.getUTCDate());
    if (diff === 0) return '오늘 ' + text;
    if (diff === 1) return '내일 ' + text;
    return WD[w.getUTCDay()] + '요일 ' + text;
  }
  function isClosedDay(w) {
    var day = w.getUTCDay();
    return day === 0 || day === 6 || !!HOLIDAYS[kstIso(w)];
  }
  /* from 다음 날부터 10일 안에서 처음 만나는 접수일(09:00) */
  function nextOpenDay(from) {
    var base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    for (var i = 1; i <= 10; i++) {
      var cand = new Date(base.getTime() + i * 86400000);
      if (!isClosedDay(cand)) return cand;
    }
    return null;
  }

  function applyGate() {
    var w = kstWall();
    var mins = w.getUTCHours() * 60 + w.getUTCMinutes();
    var iso = kstIso(w);
    var holiday = HOLIDAYS[iso];
    var g = {
      open: false, reason: 'open', iso: iso, minutes: mins, left: 0,
      hours: '평일 09:00~17:30 (KST)', head: '', tip: '', short: '', card: '', next: null
    };

    if (holiday) g.reason = 'holiday';
    else if (w.getUTCDay() === 0 || w.getUTCDay() === 6) g.reason = 'weekend';
    else if (mins < APPLY_FROM) g.reason = 'before';
    else if (mins >= APPLY_TO) g.reason = 'after';
    else { g.open = true; g.left = APPLY_TO - mins; }

    if (g.open) {
      g.head = '지금은 청약 접수 시간이에요';
      g.tip = '오늘 17:30 마감' + (g.left <= 120 ? ' · ' + minutesText(g.left) + ' 남았어요' : '');
      g.short = '청약홈에서 신청하기';
      return g;
    }

    if (g.reason === 'before') {
      g.next = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
      g.head = '오전 9시부터 신청할 수 있어요';
      g.tip = minutesText(APPLY_FROM - mins) + ' 남았어요';
      g.short = '접수 시작 전 — 09:00부터';
      g.card = '09:00부터 신청';
      return g;
    }

    g.next = nextOpenDay(w);
    var dayText = g.next ? dayLabel(g.next) : '다음 접수일';
    var when = dayText + ' 09:00부터 신청할 수 있어요';
    if (g.reason === 'after') {
      g.head = '오늘 접수 시간(17:30)이 지났어요';
      g.tip = when;
      g.short = '오늘 접수 마감 — ' + dayText + ' 09:00부터';
      g.card = dayText + ' 09:00부터';
    } else if (g.reason === 'weekend') {
      g.head = '주말에는 청약 접수가 없어요';
      g.tip = when;
      g.short = '주말 — ' + dayText + ' 09:00부터';
      g.card = dayText + ' 09:00부터';
    } else {
      g.head = '공휴일(' + holiday + ')에는 청약 접수가 없어요';
      g.tip = when;
      g.short = '공휴일 — ' + dayText + ' 09:00부터';
      g.card = dayText + ' 09:00부터';
    }
    return g;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        housing: state.housing,
        residence: state.residence,
        depositWon: state.deposit,
        householder: state.householder,
        favs: state.favs
      }));
    } catch (e) { /* 저장 실패는 무시 */ }
  }
  function load() {
    var s = null;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) s = JSON.parse(raw);
      if (!s) {
        /* 예전 버전(v2)은 예치금을 만원 단위(예: 204)로 저장했다 — 원 단위로 옮겨 온다. */
        raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          s = JSON.parse(raw);
          if (typeof s.deposit === 'number') s.depositWon = s.deposit * 10000;
        }
      }
    } catch (e) { s = null; }
    if (!s) return;
    try {
      if (HOUSING.some(function (o) { return o.v === s.housing; })) state.housing = s.housing;
      if (REGIONS.some(function (o) { return o.v === s.residence; })) state.residence = s.residence;
      if (typeof s.depositWon === 'number' && isFinite(s.depositWon) && s.depositWon >= 0) {
        state.deposit = Math.min(Math.round(s.depositWon), 999999999);
      }
      if (HOUSEHOLDER.some(function (o) { return o.v === s.householder; })) state.householder = s.householder;
      if (Array.isArray(s.favs)) state.favs = s.favs.slice(0, 20);
    } catch (e) { /* 무시 */ }
    try {
      var rawA = localStorage.getItem(APPLIED_KEY);
      if (rawA) {
        var a = JSON.parse(rawA);
        if (a && typeof a === 'object') state.applied = a;
      }
    } catch (e) { /* 무시 */ }
  }

  function saveApplied() {
    try { localStorage.setItem(APPLIED_KEY, JSON.stringify(state.applied)); } catch (e) { /* 무시 */ }
  }

  /* ───────────────────────── 판정 ───────────────────────── */
  function evaluate(L) {
    var fails = [], passes = [], warns = [];
    var H = state.housing, D = state.deposit, HH = state.householder;
    var mine = mySidos();

    /* 1. 주택 수 */
    if (L.housingRequirement === '무주택 전용') {
      if (H !== '무주택') fails.push({ text: '무주택세대구성원만 신청 가능 (현재 ' + H + ')' });
      else passes.push('무주택 조건 충족');
    } else if (L.housingRequirement === '1주택 가능') {
      if (H === '2주택+') fails.push({ text: '2주택 이상은 1순위 신청 불가' });
      else if (H === '1주택') passes.push('1주택도 1순위 가능');
      else passes.push('무주택 — 1순위 가능');
    } else if (L.housingRequirement === '무관') {
      passes.push('청약통장·주택 수 무관');
    } else {
      fails.push({ text: '공고문 원문에서 자격을 확인하지 못했어요 — 지원 전 공고문 확인 필요' });
    }

    /* 2. 거주지 */
    var allowed = L.eligibleRegions || [];
    var pri = L.priorityRegions || [];
    if (L.residenceRequirement === '확인 필요' || !allowed.length) {
      fails.push({ text: '거주지 요건을 원문에서 확인하지 못했어요 — 지원 전 공고문 확인 필요' });
    } else if (L.residenceRequirement === '전국' || allowed.length >= 17) {
      passes.push('전국 신청 가능');
    } else if (!cross(mine, allowed).length) {
      fails.push({ text: regionLabel(allowed) + ' 거주자만 신청 가능 (현재 ' + state.residence + ')' });
    } else if (pri.length && !cross(mine, pri).length) {
      passes.push(regionLabel(allowed) + ' 거주 — 기타지역');
      warns.push(regionLabel(pri) + ' 해당지역 우선 — 남은 물량만');
    } else if (pri.length) {
      passes.push(regionLabel(pri) + ' 거주 — 해당지역');
    } else {
      passes.push(regionLabel(allowed) + ' 거주');
    }

    /* 3. 예치금 */
    var need = (L.requiredDeposit || 0) * 10000;
    if (D < need) {
      fails.push({ text: '예치금 ' + moneyLabel(need - D) + ' 부족 (' + moneyLabel(need) + ' 필요)' });
    } else if (need > 0) {
      passes.push('예치금 ' + moneyLabel(need) + ' 충족');
    } else {
      passes.push('예치금 요건 없음');
    }

    /* 4. 세대주 */
    if (L.householderOnly && HH !== '세대주') {
      fails.push({ text: '무주택세대의 세대주만 신청 가능' });
    }

    (L.extraRequirements || []).forEach(function (x) {
      /* 소득·자산은 카드의 수치 요약 박스와 드로어 표로 따로 보여 준다 */
      if (L.incomeAsset && /소득|자산/.test(x)) return;
      warns.push(x);
    });

    var status = statusOf(L);
    if (status.key === 'closed') warns.push('접수 마감된 공고');
    if (!L.verified) warns.push('공고문 원문 확인 필요');

    return { l: L, fails: fails, passes: passes, warns: warns, status: status, ok: fails.length === 0 };
  }

  /* ─────────────────── 소득·자산 기준 표시 ─────────────────── */
  var iaHousehold = 0;   /* 드로어에서 고른 가구원수 칸(0부터) */

  /* 카드·판정에 쓰는 한 줄 요약 */
  function iaSummary(ia) {
    if (!ia) return '';
    if (ia.status === '기준 없음') return '소득·자산 기준 없음';
    if (ia.status !== '확인') return '소득·자산 기준 원문 확인 필요';
    var singles = [], duals = [];
    (ia.rows || []).forEach(function (r) {
      if (singles.indexOf(r.pct) === -1) singles.push(r.pct);
      if (r.dualPct && duals.indexOf(r.dualPct) === -1) duals.push(r.dualPct);
    });
    (ia.levels || []).forEach(function (l) { if (singles.indexOf(l.pct) === -1) singles.push(l.pct); });
    singles.sort(function (a, b) { return a - b; });
    duals.sort(function (a, b) { return a - b; });
    var bits = [];
    if (singles.length) {
      bits.push('소득 ' + (singles.length > 1 ? singles[0] + '~' + singles[singles.length - 1] : singles[0]) + '%' +
        (duals.length ? ' (맞벌이 ' + duals[duals.length - 1] + '%)' : ''));
    }
    if (ia.asset && ia.asset.realEstate) {
      bits.push('자산 부동산 ' + cheonShort(ia.asset.realEstate) +
        (ia.asset.car ? '·차 ' + cheonShort(ia.asset.car) : ''));
    } else if (singles.length) {
      bits.push('자산 기준 없음');
    }
    return bits.join(' · ');
  }

  function cardIncomeHTML(L) {
    var ia = L.incomeAsset;
    if (!ia) return '';
    var tone = ia.status === '확인' ? 'ok' : ia.status === '기준 없음' ? 'none' : 'need';
    var text = ia.status === '기준 없음'
      ? '기준 없음 — 청약통장·소득·자산과 관계없이 신청'
      : ia.status === '확인' ? iaSummary(ia)
      : '원문 확인 필요 — 공고문 PDF 미첨부';
    return '<div class="card-income card-income--' + tone + '">' +
      '<span class="ci-tag">소득·자산</span>' +
      '<span class="ci-text">' + esc(text) + '</span>' +
      '</div>';
  }

  function iaTableHTML(ia) {
    var cols = ia.columns || [];
    var idx = Math.min(Math.max(iaHousehold, 0), Math.max(cols.length - 1, 0));
    var hh = cols.length ? '<div class="ia-hh" role="group" aria-label="가구원수">' +
      cols.map(function (c, i) {
        return '<button type="button" data-ia-hh="' + i + '" aria-pressed="' + (i === idx) + '">' + esc(c) + '</button>';
      }).join('') + '</div>' : '';
    var rows = ia.rows || [], body = '', lastGroup = null;
    var hasDual = rows.some(function (r) { return !!(r.dualPct && r.dualAmounts); });
    rows.forEach(function (r) {
      var amt = (r.amounts || [])[idx];
      var dual = r.dualAmounts ? r.dualAmounts[idx] : null;
      var groupCell = r.group && r.group !== lastGroup ? '<b class="ia-group">' + esc(r.group) + '</b>' : '';
      if (r.group) lastGroup = r.group;
      body += '<tr>' +
        '<td class="ia-what">' + groupCell + (r.label ? '<span>' + esc(r.label) + '</span>' : '') + '</td>' +
        '<td class="ia-num"><span>' + r.pct + '%</span><b>' + (amt == null ? '—' : wonShort(amt)) + '</b></td>' +
        (hasDual ? '<td class="ia-num">' + (r.dualPct
          ? '<span>' + r.dualPct + '%</span><b>' + (dual == null ? '—' : wonShort(dual)) + '</b>'
          : '<span class="ia-dash">—</span>') + '</td>' : '') +
        '</tr>';
    });
    var levelRows = '';
    (ia.levels || []).forEach(function (l) {
      var amt = (l.amounts || [])[idx];
      levelRows += '<tr><td class="ia-what"><span>소득 ' + l.pct + '% 이하</span></td>' +
        '<td class="ia-num"><b>' + (amt == null ? '—' : wonShort(amt)) + '</b></td>' +
        (hasDual ? '<td class="ia-num ia-dash">—</td>' : '') + '</tr>';
    });
    if (!body && !levelRows) return hh;
    return hh +
      '<div class="ia-table-wrap"><table class="d-table ia-table">' +
      '<thead><tr><th>구분</th><th>소득 기준</th>' + (hasDual ? '<th>맞벌이</th>' : '') + '</tr></thead>' +
      '<tbody>' + body + levelRows + '</tbody></table></div>'; }

  function incomeAssetHTML(L) {
    var ia = L.incomeAsset;
    if (!ia) return '';
    var badge = ia.status === '확인' ? '<span class="ia-badge ia-badge--ok">공고문 확인</span>' :
      ia.status === '기준 없음' ? '<span class="ia-badge ia-badge--none">기준 없음</span>' :
      '<span class="ia-badge ia-badge--need">원문 확인 필요</span>';
    var inner = '';
    if (ia.applies) {
      inner += '<p class="ia-applies"><b>적용 대상</b> ' + esc(ia.applies) + '</p>';
    }
    if (ia.status === '확인') {
      if ((ia.rows && ia.rows.length) || (ia.levels && ia.levels.length)) {
        inner += '<p class="ia-cap">' + esc(ia.incomeLabel || '전년도 도시근로자 가구당 월평균소득') +
          ' 기준 — 가구원수를 고르면 그 가구의 기준액이 보여요.</p>';
        inner += iaTableHTML(ia);
      }
      if (ia.asset && ia.asset.realEstate) {
        inner += '<ul class="ia-asset">' +
          '<li><span>부동산(건물+토지) 공시가격</span><b>' + cheonShort(ia.asset.realEstate) + ' 원 이하</b></li>' +
          (ia.asset.car ? '<li><span>자동차(비영업용 승용)</span><b>' + cheonShort(ia.asset.car) + ' 원 이하</b></li>' : '') +
          '</ul>';
        var rb = ia.asset.relaxedForBirth;
        if (rb && rb.realEstate1Child) {
          inner += '<p class="ia-note">출산가구 완화 — 자녀 1명: 부동산 ' + cheonShort(rb.realEstate1Child) +
            (rb.car1Child ? '·자동차 ' + cheonShort(rb.car1Child) : '') +
            ' / 2명 이상: 부동산 ' + cheonShort(rb.realEstate2Child) +
            (rb.car2Child ? '·자동차 ' + cheonShort(rb.car2Child) : '') + ' 이하</p>';
        }
      } else if ((ia.rows && ia.rows.length) || (ia.levels && ia.levels.length)) {
        inner += '<p class="ia-note">공고문에 별도의 자산보유기준은 없습니다.</p>';
      }
    }
    if (ia.note) inner += '<p class="ia-warn">' + esc(ia.note) + '</p>';
    if (ia.generalNote) inner += '<p class="ia-note">' + esc(ia.generalNote) + '</p>';
    if (ia.source) {
      inner += '<p class="ia-source">근거 · ' + esc(ia.source) + (ia.checkedAt ? ' · ' + esc(ia.checkedAt) + ' 확인' : '') + '</p>';
    }
    return '<section class="d-sec" id="drawerIncome">' +
      '<h3 class="d-sec-title">소득·자산 기준 ' + badge + '</h3>' + inner + '</section>';
  }

  function evaluateAll() { evalCache = LISTINGS.map(evaluate); return evalCache; }

  /* ───────────────────────── 조건 UI ───────────────────────── */
  function segHTML(list, current, name) {
    return list.map(function (o) {
      return '<button type="button" data-seg="' + name + '" data-value="' + esc(o.v) + '"' +
        ' aria-pressed="' + (o.v === current) + '">' + esc(o.l) + '</button>';
    }).join('');
  }

  function regionHTML() {
    return REGIONS.map(function (o) {
      return '<button type="button" class="region-btn" data-region="' + esc(o.v) + '"' +
        ' aria-pressed="' + (o.v === state.residence) + '">' + esc(o.l) + '</button>';
    }).join('');
  }

  function depositHint() {
    var g = state.residence;
    if (g === '서울') return '서울 85㎡ 이하 1순위 기준 300만 원';
    if (g === '부산·울산·경남') return '부산 300만 · 울산 250만 · 경남 200만 원';
    if (g === '인천' || g === '대구·경북') return '광역시 250만 · 도 지역 200만 원';
    if (g === '대전·세종·충청') return '대전 250만 · 세종·충북·충남 200만 원';
    if (g === '광주·전라') return '광주 250만 · 전북·전남 200만 원';
    return '경기·강원·제주 85㎡ 이하 기준 200만 원';
  }

  function renderCondition() {
    $('#segHousing').innerHTML = segHTML(HOUSING, state.housing, 'housing');
    $('#segHouseholder').innerHTML = segHTML(HOUSEHOLDER, state.householder, 'householder');
    $('#segResidence').innerHTML = regionHTML();
    renderDeposit(true);
    renderMini();
  }

  /* 예치금 표시 — 버튼(50만)·슬라이더(10만)·직접 입력(원)을 같은 값에서 그린다. */
  function renderDeposit(syncInput) {
    var v = state.deposit;
    $('#depositValue').textContent = won(v);
    $('#depositHint').textContent = depositHint();

    $('#depositChips').innerHTML = DEPOSIT_CHIPS.map(function (c) {
      var active = c.v === 5000000 ? v >= 5000000 : v === c.v;
      return '<button type="button" class="chip-btn" data-dep="' + c.v + '" aria-pressed="' + active + '">' +
        esc(c.l) + '</button>';
    }).join('');

    var range = $('#depositRange');
    var snapped = Math.round(v / DEP_STEP) * DEP_STEP;
    range.value = Math.max(0, Math.min(snapped, DEP_MAX));
    range.style.setProperty('--p', (Math.min(v, DEP_MAX) / DEP_MAX * 100) + '%');

    var inp = $('#depositInput');
    if (syncInput && document.activeElement !== inp) inp.value = v ? num(v) : '';
  }

  function setDeposit(v, opts) {
    state.deposit = Math.max(0, Math.min(Math.round(v), 999999999));
    renderDeposit(!(opts && opts.keepInput));
    renderMini();
    evaluateAll();
    renderResults();
    save();
  }

  function renderMini() {
    $('#miniChips').innerHTML =
      '<span class="mini-chip"><b>' + esc(state.residence) + '</b></span>' +
      '<span class="mini-chip"><b>' + esc(state.housing) + '</b></span>' +
      '<span class="mini-chip"><b>' + (state.deposit === 0 ? '예치금 없음' : '예치금 ' + moneyChip(state.deposit)) + '</b></span>' +
      '<span class="mini-chip">' + esc(state.householder) + '</span>';
  }

  /* ───────────────────────── 결과 ───────────────────────── */
  function counts() {
    var ok = 0, open = 0, total = 0;
    evalCache.forEach(function (e) {
      if (isEnded(e)) return;      /* 마감된 공고는 카운트에도 넣지 않는다 */
      total++;
      if (e.ok) {
        ok++;
        if (e.status.key === 'open' || e.status.key === 'upcoming') open++;
      }
    });
    return { ok: ok, excluded: total - ok, open: open, total: total };
  }

  /* ── 지금 화면에 실제로 보이는 관심 공고 ──
     localStorage의 favs에는 예전에 담아 둔 ID가 그대로 남아 있을 수 있다 — 접수가 끝난 공고,
     새로 받아온 listings.json에서 빠진 공고. 관심 탭 목록·관심 숫자(세그먼트·하단 바)·
     연속 신청 모드·발표일 겹침 검사는 모두 이 목록 하나만 센다.
     그래서 화면에 보이는 관심 카드 수와 '관심 N' 숫자가 언제나 같다. */
  function favEntries() {
    var out = [];
    evalCache.forEach(function (e) {
      if (isEnded(e)) return;
      if (state.favs.indexOf(e.l.id) !== -1) out.push(e);
    });
    return out;
  }
  function favCount() { return favEntries().length; }
  /* 화면·숫자에서 빠진 관심 ID — 접수가 끝났거나 목록에 없는 공고 */
  function staleFavIds() {
    var seen = {};
    favEntries().forEach(function (e) { seen[e.l.id] = 1; });
    return state.favs.filter(function (id) { return !seen[id]; });
  }

  function conflictMap() {
    var groups = {}, map = {};
    favEntries().forEach(function (e) {
      var L = e.l;
      if (!L.winnersDate) return;
      (groups[L.winnersDate] = groups[L.winnersDate] || []).push(L);
    });
    Object.keys(groups).forEach(function (k) {
      if (groups[k].length > 1) groups[k].forEach(function (L) { map[L.id] = groups[k]; });
    });
    return { groups: groups, map: map };
  }

  function filterList() {
    var cm = conflictMap();
    return evalCache.filter(function (e) {
      /* 관심도 다른 탭과 같은 기준 — 접수 마감·목록에서 빠진 공고는 관심 탭에도 올리지 않는다 */
      if (isEnded(e)) return false;
      if (state.filter === 'fav') return state.favs.indexOf(e.l.id) !== -1;
      if (state.filter === 'eligible') return e.ok;
      if (state.filter === 'excluded') return !e.ok;
      return true;
    }).map(function (e) {
      return { e: e, conflict: !!cm.map[e.l.id] };
    });
  }

  function sortList(rows) {
    var s = state.sort;
    var rank = { open: 0, upcoming: 1, closed: 2, unknown: 3 };
    return rows.slice().sort(function (a, b) {
      var A = a.e, B = b.e;
      if (s === 'price') {
        var pa = A.l.priceMin, pb = B.l.priceMin;
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return pa - pb;
      }
      if (s === 'units') {
        var ua = A.l.units, ub = B.l.units;
        if (ua == null && ub == null) return 0;
        if (ua == null) return 1;
        if (ub == null) return -1;
        return ub - ua;
      }
      if (s === 'announce') {
        var aa = A.l.winnersDate, ba = B.l.winnersDate;
        if (!aa && !ba) return 0;
        if (!aa) return 1;
        if (!ba) return -1;
        return aa < ba ? -1 : aa > ba ? 1 : 0;
      }
      if (s === 'region') {
        var ra0 = A.l.region || '', rb0 = B.l.region || '';
        if (ra0 !== rb0) return ra0 < rb0 ? -1 : 1;
      }
      /* deadline */
      var ra = rank[A.status.key], rb = rank[B.status.key];
      if (ra !== rb) return ra - rb;
      var ea = A.l.applyEnd, eb = B.l.applyEnd;
      if (!ea && !eb) return 0;
      if (!ea) return 1;
      if (!eb) return -1;
      return A.status.key === 'closed' ? (ea < eb ? 1 : -1) : (ea < eb ? -1 : 1);
    });
  }

  function reasonsFor(e) {
    var items = [];
    e.fails.forEach(function (f) { items.push({ t: 'no', text: f.text }); });
    e.warns.forEach(function (w) { items.push({ t: 'warn', text: w }); });
    e.passes.forEach(function (p) { items.push({ t: 'ok', text: p }); });
    var max = e.ok ? 3 : 2;
    return { shown: items.slice(0, max), extra: Math.max(0, items.length - max) };
  }

  function ddayClass(st) {
    if (st.key === 'open') return st.urgent ? 'dday dday--soon' : 'dday dday--open';
    if (st.key === 'upcoming') return 'dday dday--upcoming';
    if (st.key === 'closed') return 'dday dday--closed';
    return 'dday dday--unknown';
  }

  /* ─────────────────── 청약홈 신청 동선 ─────────────────── */
  function dateRange(a, b) {
    if (!a && !b) return '';
    if (!a || !b || a === b) return md(a || b);
    return md(a) + '~' + md(b);
  }

  /* '청약홈 로그인 먼저 하기' 링크 + 한 줄 안내 — 연속 신청 모드와 드로어 신청 박스가 함께 쓴다.
     비로그인 상태에서 신청 버튼을 누르면 로그인 화면을 거치며 보던 자리를 잃는다는 것을
     버튼 위에서 먼저 알려 주고, 로그인은 새 탭에서 하게 해 이 앱 화면을 잃지 않게 한다. */
  function loginFirstHTML(variant, applyLabel) {
    return '<div class="login-first login-first--' + variant + '">' +
      '<a class="login-first-link" href="' + APPLYHOME_LOGIN_URL + '" target="_blank" rel="noopener">' +
        '1) 청약홈 로그인 먼저 하기 ↗</a>' +
      '<p class="login-first-tip">비로그인 상태에서 <b>' + esc(applyLabel) + '</b>를 누르면 로그인 화면을 거친 뒤 ' +
        '신청 화면이 처음으로 돌아가요. 한 번만 미리 로그인해 두면 바로 신청 화면으로 들어가요.</p>' +
    '</div>';
  }

  function applyNote(L, st) {
    var bits = [];
    var range = dateRange(L.applyStart, L.applyEnd);
    if (st.key === 'upcoming') {
      /* 접수 시작 전에는 '청약홈 로그인 후 신청'을 붙이지 않는다 — 지금 신청할 수 있다고 읽힌다 */
      if (L.applyStart) {
        return '접수 시작 ' + mdw(L.applyStart) + ' 09:00' +
          (L.applyEnd && L.applyEnd !== L.applyStart ? ' · 마감 ' + md(L.applyEnd) : '');
      }
      return '접수일 미정';
    } else if (st.key === 'closed') {
      /* 이미 끝난 접수다 — '청약홈 로그인 후 신청'을 붙이면 지금도 신청할 수 있는 것처럼 읽힌다 */
      return range ? '접수 ' + range + ' 마감' : '접수 마감';
    } else if (range) {
      bits.push('접수 ' + range);
      if (st.key === 'open' && st.days === 0) bits.push('오늘 17:30까지');
    }
    bits.push('청약홈 로그인 후 신청');
    return bits.join(' · ');
  }

  /* 카드·드로어의 버튼 하나만 상태에 따라 바뀐다: 신청 → 접수 시간 아님 → 공고 보기(마감·미달) */
  function applyMeta(L, st, ok) {
    var applyUrl = L.applyUrl || '';
    var detailUrl = L.detailUrl || L.applyhomeUrl || '';
    var path = L.applyPath || '청약홈 청약신청';
    var gate = applyGate();
    var endedToday = st.key === 'open' && st.days === 0 && gate.reason === 'after';
    if (ok && st.key === 'open' && applyUrl) {
      if (endedToday) {
        /* 오늘이 마지막 접수일인데 17:30이 지났다 — 이 공고는 이미 끝났다 */
        return { kind: 'ended', label: '오늘 접수 마감 · 공고 보기', short: '오늘 접수 끝',
          url: detailUrl, path: path, tone: 'muted',
          note: '오늘 접수 시간(17:30)이 지나 이 공고는 신청할 수 없어요' +
            (gate.next ? ' · ' + dayLabel(gate.next) + ' 09:00부터 다른 공고를 신청할 수 있어요' : ''),
          gate: gate, detailUrl: detailUrl };
      }
      if (!gate.open) {
        /* 접수 기간은 맞지만 지금은 접수 시간이 아니다 — 신청 화면으로 넘기지 않는다 */
        return { kind: 'time', label: '청약 접수 시간(09:00~17:30)이 아니에요',
          short: '지금은 접수 시간 아님', url: detailUrl, path: path, tone: 'time',
          note: gate.head + ' · ' + gate.tip, gate: gate, detailUrl: detailUrl };
      }
      return { kind: 'apply', label: '청약홈에서 신청하기', short: '청약홈에서 신청 →',
        url: applyUrl, path: path, tone: 'go', note: applyNote(L, st), gate: gate };
    }
    if (st.key === 'closed') {
      return { kind: 'closed', label: '접수 마감 · 공고 보기', short: '공고 보기',
        url: detailUrl, path: path, tone: 'muted', note: applyNote(L, st) };
    }
    if (ok && st.key === 'upcoming' && applyUrl) {
      /* 아직 접수 시작 전 — 신청 버튼이 아니라 '신청일이 아니다' 안내로 둔다 */
      return { kind: 'wait', label: '아직 신청일이 아니에요 · ' + st.days + '일 남았어요',
        short: 'D-' + st.days + ' · 접수 시작 전', url: detailUrl, path: path, tone: 'wait',
        note: applyNote(L, st) };
    }
    if (!ok) {
      return { kind: 'no', label: '내 조건으로는 신청 불가 · 공고 보기', short: '공고 보기',
        url: detailUrl, path: path, tone: 'muted', note: '' };
    }
    return { kind: 'detail', label: '청약홈 공고 보기', short: '공고 보기',
      url: detailUrl, path: path, tone: 'muted', note: applyNote(L, st) };
  }

  function applyBoxHTML(e) {
    var L = e.l, st = e.status;
    var cta = applyMeta(L, st, e.ok);
    var fine = '<p class="apply-fine">신청·전자서명은 청약홈에서 본인 인증(공동인증서·금융인증서) 후 직접 해야 해요. 이 앱은 신청을 대신하지 않아요.</p>';

    /* 접수 시간 밖 — 신청 버튼을 잠그고 공고 확인 링크만 남긴다 */
    if (cta.kind === 'time') {
      var g = cta.gate;
      var look = [];
      if (cta.detailUrl) look.push('<a class="d-link" href="' + esc(cta.detailUrl) + '" target="_blank" rel="noopener">청약홈 공고 보기 ↗</a>');
      if (L.pdfUrl) look.push('<a class="d-link" href="' + esc(L.pdfUrl) + '" target="_blank" rel="noopener">공고문 PDF 열기 ↗</a>');
      return '<section class="d-sec d-apply">' +
        '<div class="apply-cta apply-cta--time" role="note">' +
          CLOCK_SVG +
          '<span class="apply-cta-label">청약 접수 시간(09:00~17:30)이 아니에요</span>' +
        '</div>' +
        '<p class="apply-note apply-note--time"><b>' + esc(g.head) + '</b><br>' +
          esc(g.hours) + ' · ' + esc(g.tip) + '</p>' +
        (look.length ? '<div class="apply-alt">' + look.join('') + '</div>' : '') +
        fine +
      '</section>';
    }

    var alt = [];
    /* 접수 시작 전(D-n) — 신청 버튼 대신 '아직 신청일이 아니다' 안내만 두고,
       공고 원문·PDF는 작은 링크로 남긴다. */
    if (cta.kind === 'wait') {
      var det = cta.detailUrl || L.detailUrl || L.applyhomeUrl || '';
      if (det) alt.push('<a class="d-link" href="' + esc(det) + '" target="_blank" rel="noopener">청약홈 공고 보기 ↗</a>');
      if (L.pdfUrl) alt.push('<a class="d-link" href="' + esc(L.pdfUrl) + '" target="_blank" rel="noopener">공고문 PDF 열기 ↗</a>');
      return '<section class="d-sec d-apply">' +
        '<div class="apply-cta apply-cta--time" role="note">' +
          CLOCK_SVG +
          '<span class="apply-cta-label">아직 신청일이 아니에요 · ' + st.days + '일 남았어요</span>' +
        '</div>' +
        '<p class="apply-note apply-note--time"><b>' + esc(applyNote(L, st)) + '</b>' +
          (L.applyPath ? '<br>' + esc(L.applyPath) + '로 접수해요' : '') + '</p>' +
        (alt.length ? '<div class="apply-alt">' + alt.join('') + '</div>' : '') +
        fine +
      '</section>';
    }

    /* 신청 화면 참고 링크는 일정 미확인 공고에만 둔다.
       마감·조건 미달 공고는 신청할 수 없으므로 공고 상세·공고문만 연다. */
    if (L.applyUrl && L.applyUrl !== cta.url && cta.kind === 'detail') {
      alt.push('<a class="d-link" href="' + esc(L.applyUrl) + '" target="_blank" rel="noopener">' +
        esc(L.applyPath || '청약신청 화면') + ' ↗</a>');
    }
    return '<section class="d-sec d-apply">' +
      (cta.kind === 'apply' ? loginFirstHTML('drawer', '청약홈에서 신청하기') : '') +
      '<a class="apply-cta apply-cta--' + cta.tone + '" href="' + esc(cta.url) + '" target="_blank" rel="noopener">' +
        '<span class="apply-cta-label">' + esc(cta.label) + '</span>' +
        (cta.kind === 'apply' ? '<span class="apply-cta-arrow">→</span>' : '') +
      '</a>' +
      (cta.note ? '<p class="apply-note">' + esc(cta.note) + '</p>' : '') +
      (alt.length ? '<div class="apply-alt">' + alt.join('') + '</div>' : '') +
      fine +
    '</section>';
  }

  function cardHTML(row) {
    var e = row.e, L = e.l, st = e.status;
    var isFav = state.favs.indexOf(L.id) !== -1;
    var rs = reasonsFor(e);

    var chips = '<span class="chip chip-region">' + esc(L.region) + '</span>' +
      '<span class="chip chip-type">' + esc(L.supplyType) + '</span>';
    if (row.conflict) chips += '<span class="chip chip-warn">발표일 중복</span>';
    if (!L.verified) chips += '<span class="chip chip-muted">원문 미확인</span>';

    var price = L.priceMin == null ? '가격 미확인' : L.priceRange;
    var priceLabel = L.priceLabel || '분양가';
    var units = L.units == null ? '물량 미확인' : num(L.units) + '세대';
    var dep = L.requiredDeposit > 0 ? num(L.requiredDeposit) + '만' : '없음';

    var reasonsHTML = rs.shown.map(function (r) {
      var ico = r.t === 'no' ? '✕' : r.t === 'warn' ? '!' : '✓';
      return '<li class="r-' + r.t + '"><span class="r-ico">' + ico + '</span><span>' + esc(r.text) + '</span></li>';
    }).join('');
    if (rs.extra > 0) reasonsHTML += '<li class="r-more">외 ' + rs.extra + '가지 조건</li>';

    var announce = L.winnersDate ? '발표 <b>' + mdw(L.winnersDate) + '</b>' : '발표일 미정';
    var cta = applyMeta(L, st, e.ok);
    var applyRow = '';
    if (cta.kind === 'apply') {
      applyRow = '<a class="card-apply" data-apply href="' + esc(cta.url) + '" target="_blank" rel="noopener"' +
        ' aria-label="' + esc(L.name) + ' — 청약홈에서 신청">청약홈에서 신청하기 <b>→</b></a>';
    } else if (cta.kind === 'time') {
      applyRow = '<button type="button" class="card-apply card-apply--time" data-time-note' +
        ' aria-label="' + esc(L.name) + ' — 청약 접수 시간이 아니에요">' +
        CLOCK_SVG + '접수 시간 아님 · ' + esc(cta.gate.card) + '</button>';
    } else if (cta.kind === 'ended') {
      /* 오늘 17:30이 지나 끝난 공고 — 신청 링크 대신 상태만 알리고 자세히로 보낸다 */
      applyRow = '<p class="card-status"><b>오늘 접수 마감(17:30)</b>' +
        '<span>신청할 수 없어요</span></p>';
    } else if (cta.kind === 'wait') {
      /* 접수 시작 전(D-n) — 큰 버튼 대신 '아직 신청일이 아니다' 안내 */
      applyRow = '<p class="card-status"><b>아직 신청일이 아니에요</b>' +
        '<span>' + st.days + '일 남았어요 · ' + md(L.applyStart) + ' 접수 시작</span></p>';
    }

    return '' +
      '<article class="card' + (isFav ? ' is-fav' : '') + '" data-id="' + esc(L.id) + '" tabindex="0" role="button" ' +
      'aria-label="' + esc(L.name) + ' 상세 보기">' +
        '<div class="card-top">' +
          '<div class="card-chips">' + chips + '</div>' +
          '<span class="' + ddayClass(st) + '">' + esc(st.label) + '</span>' +
        '</div>' +
        '<h3 class="card-name">' + esc(L.name) + '</h3>' +
        '<p class="card-loc">' + esc(L.region) + ' ' + esc(L.district || '') + '</p>' +
        '<div class="card-facts">' +
          '<div class="card-fact"><span>' + esc(priceLabel) + '</span><b>' + esc(price) + '</b></div>' +
          '<div class="card-fact"><span>물량</span><b>' + esc(units) + '</b></div>' +
          '<div class="card-fact"><span>예치금</span><b>' + esc(dep) + '</b></div>' +
        '</div>' +
        cardIncomeHTML(L) +
        '<div class="card-verdict">' +
          '<span class="verdict ' + (e.ok ? 'verdict-ok' : 'verdict-no') + '">' +
            (e.ok ? '✓ 지원 가능' : '✕ 조건 미달') +
          '</span>' +
        '</div>' +
        '<ul class="reasons">' + reasonsHTML + '</ul>' +
        applyRow +
        '<div class="card-foot">' +
          '<span class="card-announce">' + announce + '</span>' +
          '<div class="card-actions">' +
            '<button type="button" class="fav" data-fav="' + esc(L.id) + '" aria-pressed="' + isFav + '">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5l-1.6-1.45C5.4 14.5 2.5 11.9 2.5 8.7 2.5 6.1 4.5 4 7.1 4c1.5 0 2.9.7 3.9 1.9C12 4.7 13.4 4 14.9 4 17.5 4 19.5 6.1 19.5 8.7c0 3.2-2.9 5.8-7.9 10.35L12 20.5z"/></svg>' +
              '관심' +
            '</button>' +
            '<span class="detail-btn">자세히 →</span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function adCardHTML() {
    return '' +
      '<div class="ad-card">' +
        '<div class="ad-card-body">' +
          '<span class="ad-label">광고 · 제휴 슬롯 예시</span>' +
          '<p class="ad-card-title">예치금이 모자랄 때 — 청약예치금·전세자금 대출 금리 비교</p>' +
          '<p class="ad-card-copy">은행별 금리·한도를 한 번에 비교하고 이자 차이를 확인하세요</p>' +
        '</div>' +
        '<span class="ad-card-cta">비교하기</span>' +
      '</div>';
  }

  function renderResults() {
    var c = counts();
    var gate = applyGate();
    $('#hdrCount').textContent = c.total;   /* 헤더 카운트도 지금 볼 수 있는 공고만 센다 */
    $('#eligibleCount').textContent = c.ok;
    $('#resultsSub').innerHTML = gate.open
      ? '지원 가능 <b>' + c.ok + '건</b> 중 지금 접수 가능 <b>' + c.open + '건</b> · 조건 미달 ' + c.excluded + '건'
      : '지원 가능 <b>' + c.ok + '건</b> 중 접수 중 <b>' + c.open + '건</b> · 지금은 접수 시간이 아니에요 · 조건 미달 ' + c.excluded + '건';

    $('#segFilter').innerHTML = [
      { v: 'eligible', l: '지원 가능', n: c.ok },
      { v: 'excluded', l: '조건 미달', n: c.excluded },
      { v: 'fav', l: '관심', n: favCount() },
      { v: 'all', l: '전체', n: c.total }
    ].map(function (o) {
      return '<button type="button" data-filter="' + o.v + '" aria-pressed="' + (state.filter === o.v) + '">' +
        o.l + ' <span class="seg-count">' + o.n + '</span></button>';
    }).join('');

    var rows = sortList(filterList());
    var host = $('#cards');
    if (!rows.length) {
      host.innerHTML = emptyHTML();
    } else {
      var chunks = rows.map(cardHTML);
      if (chunks.length > 2) chunks.splice(2, 0, adCardHTML());
      if (state.filter === 'fav') {
        var stale = staleFavIds().length;
        /* 숫자와 화면이 왜 다른지 먼저 알리고, 목록에서 빠진 건은 맨 위에 둔다 */
        if (stale) chunks.unshift(favStaleHTML(stale));
      }
      host.innerHTML = chunks.join('');
    }

    renderApplyWindow();
    renderOverlap();
    renderSeqPanel();
    renderInterestBar();
  }

  /* ─────────────── 청약 접수 시간 안내 스트립 ─────────────── */
  var lastWindowHTML = '';
  var CLOCK_SVG = '<svg class="apply-cta-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<path d="M12 7.4V12l3.2 2.1" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderApplyWindow() {
    var host = $('#applyWindow');
    if (!host) return;
    var g = applyGate();
    var tone = g.open ? (g.left <= 60 ? 'soon' : 'open') : g.reason;
    var html =
      '<span class="aw-dot" aria-hidden="true"></span>' +
      '<div class="aw-body">' +
        '<b class="aw-title">' + esc(g.head) + '</b>' +
        '<span class="aw-tip">' + esc(g.tip) + '</span>' +
      '</div>' +
      '<span class="aw-hours">청약 접수 ' + esc(g.hours.replace(' (KST)', '')) + ' <b>KST</b></span>';
    /* 20초마다 다시 그려도 같은 내용이면 건드리지 않는다(스크린리더 재낭독 방지) */
    if (html === lastWindowHTML && host.className === 'apply-window apply-window--' + tone) return;
    lastWindowHTML = html;
    host.className = 'apply-window apply-window--' + tone;
    host.innerHTML = html;
  }

  /* ─────────────────── 관심 공고 연속 신청 모드 ─────────────────── */
  function appliedAt(id) { return state.applied[id] || null; }

  /* 실제로 신청할 수 있는 공고 — 접수 기간 중(접수중)이면서 내 조건을 충족한 공고.
     접수 시작 전(D-n)이거나 조건 미달인 공고는 공고만 볼 수 있으므로 '신청 완료 체크' 대상이 아니다.
     접수 시간(09:00~17:30) 밖이어도 접수 기간 중이면 신청 대상이므로 포함한다. */
  function canApplyNow(e) {
    return !!e.ok && e.status.key === 'open' && !isEnded(e);
  }

  function seqRows() {
    /* 화면에 보이는 관심 공고와 같은 목록에서 — 마감된 공고·목록에 없는 공고는 연속 신청 모드에도 없다 */
    var out = favEntries();
    var rank = { open: 0, upcoming: 1, unknown: 2, closed: 3 };
    return out.sort(function (a, b) {
      var ra = rank[a.status.key], rb = rank[b.status.key];
      if (ra !== rb) return ra - rb;
      var da = a.l.applyStart || a.l.applyEnd || '9999', db = b.l.applyStart || b.l.applyEnd || '9999';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  function seqStepHTML(e, i) {
    var L = e.l, st = e.status;
    var done = !!appliedAt(L.id);
    var applicable = canApplyNow(e);
    var cta = applyMeta(L, st, e.ok);
    var canApply = cta.kind === 'apply';
    var gated = cta.kind === 'time';
    var ended = cta.kind === 'ended';
    /* 신청할 수 없는 단계는 공고 링크를 두지 않는다 — 공고 원문은 '자세히' 드로어의 '원문 보기'에서 연다 */
    var when = st.key === 'open'
      ? (st.days === 0 ? '오늘 17:30 마감' : st.label + ' · ' + md(L.applyEnd) + ' 마감')
      : st.key === 'upcoming'
        ? (L.applyStart ? md(L.applyStart) + ' 접수 시작' : '접수일 미정')
        : st.key === 'closed' ? '접수 마감' : '일정 미확인';
    var reason = !e.ok && e.fails.length ? e.fails[0].text : '';
    /* 신청할 수 없는 이유를 버튼 자리에 한 줄로 남긴다 */
    var status = '';
    if (!canApply && !gated) {
      if (!e.ok) {
        status = '<p class="seq-status seq-status--no">✕ 내 조건으로는 신청할 수 없어요' +
          (reason ? ' <span class="seq-status-sub">· ' + esc(reason) + '</span>' : '') + '</p>';
      } else if (ended) {
        status = '<p class="seq-status">' + CLOCK_SVG + '오늘 접수 시간(17:30)이 지나 신청할 수 없어요</p>';
      } else if (st.key === 'upcoming') {
        status = '<p class="seq-status">' + CLOCK_SVG + '아직 신청일이 아니에요 · <b>' + st.days +
          '일 남았어요</b> <span class="seq-status-sub">(' + md(L.applyStart) + ' 접수 시작)</span></p>';
      } else {
        status = '<p class="seq-status">' + CLOCK_SVG + '지금은 신청할 수 없는 공고예요</p>';
      }
    }
    return '<li class="seq-step' + (done ? ' is-done' : '') + '"' +
      (applicable ? ' data-can-apply="1"' : '') + (e.ok ? ' data-ok="1"' : '') + '>' +
      '<div class="seq-rail"><span class="seq-no">' + (done ? '✓' : (i + 1)) + '</span></div>' +
      '<div class="seq-body">' +
        '<div class="seq-top">' +
          '<span class="chip chip-region">' + esc(L.region) + '</span>' +
          '<span class="chip chip-type">' + esc(L.supplyType) + '</span>' +
          '<span class="' + ddayClass(st) + '">' + esc(st.label) + '</span>' +
        '</div>' +
        '<p class="seq-name">' + esc(L.name) + '</p>' +
        '<p class="seq-meta">' + esc(when) + (L.applyPath ? ' · ' + esc(L.applyPath) : '') + '</p>' +
        status +
        '<div class="seq-actions' + (applicable || done ? '' : ' seq-actions--no-check') + '">' +
          (gated
            ? '<button type="button" class="seq-open seq-open--time" data-time-note>' +
              CLOCK_SVG + '접수 시간 아님 · ' + esc(cta.gate.card) + '</button>'
            : (canApply
              ? '<a class="seq-open" href="' + esc(cta.url) + '" target="_blank" rel="noopener" data-apply>청약홈 신청 열기 <b>→</b></a>'
              : '')) +
          (applicable || done
            ? '<button type="button" class="seq-check" data-seq-check="' + esc(L.id) + '" aria-pressed="' + done + '">' +
              (done ? '신청 완료 ✓' : '신청 완료 체크') + '</button>'
            : '') +
          '<button type="button" class="seq-detail" data-seq-detail="' + esc(L.id) + '">자세히</button>' +
        '</div>' +
      '</div></li>';
  }

  function renderSeqPanel() {
    var host = $('#seqPanel');
    if (!host) return;
    if (state.filter !== 'fav') { host.innerHTML = ''; host.hidden = true; return; }
    var rows = seqRows();
    if (!rows.length) { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;
    /* 진행률 분모는 '지금 실제로 신청할 수 있는 공고'만 센다.
       접수 예정(D-n)·조건 미달 공고는 신청 대상이 아니라 분모에서 빠지고, 진행률이 비어 보이지 않게
       그 경우에는 숫자 대신 '신청 가능 공고 없음'으로 알린다.
       이미 체크해 둔 공고는 그대로 두되(체크 해제 가능), 분모·분자에는 넣지 않는다. */
    var apt = rows.filter(canApplyNow);
    var done = apt.filter(function (e) { return !!appliedAt(e.l.id); }).length;
    var anyDone = rows.some(function (e) { return !!appliedAt(e.l.id); });
    var pct = apt.length ? Math.round(done / apt.length * 100) : 0;
    host.innerHTML = '<section class="seq" aria-labelledby="seqTitle">' +
      '<div class="seq-head">' +
        '<div class="seq-head-top">' +
          '<h3 class="seq-title" id="seqTitle">연속 신청 모드</h3>' +
          (apt.length
            ? '<span class="seq-progress-label"><b>' + done + '</b>/' + apt.length + ' 신청 완료</span>'
            : '<span class="seq-progress-label seq-progress-label--none">신청 가능 공고 없음</span>') +
        '</div>' +
        (apt.length
          ? '<div class="seq-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + apt.length + '" aria-valuenow="' + done + '">' +
            '<span style="width:' + pct + '%"></span></div>'
          : '') +
        '<p class="seq-help">' + (apt.length
          ? '청약홈은 단지마다 <b>주택형·자격 선택</b>과 <b>전자서명</b>을 거쳐야 해서 한 번에 일괄 신청은 안 돼요. 마감이 급한 순서로 열어 하나씩 신청하고 체크하세요.'
          : '청약홈은 단지마다 <b>주택형·자격 선택</b>과 <b>전자서명</b>을 거쳐야 해서 한 번에 일괄 신청은 안 돼요. <b>지금은 접수 기간 중인 공고가 없어요</b> — 접수가 시작되면 그 단계에 <b>신청 완료 체크</b>가 나타나요.') + '</p>' +
        (apt.length ? loginFirstHTML('seq', '청약홈 신청 열기') : '') +
      '</div>' +
      '<ol class="seq-list">' + rows.map(seqStepHTML).join('') + '</ol>' +
      (anyDone ? '<button type="button" class="seq-reset" id="seqReset">신청 완료 체크 모두 지우기</button>' : '') +
      '</section>';
  }

  function toggleApplied(id) {
    if (state.applied[id]) delete state.applied[id];
    else state.applied[id] = new Date().toISOString();
    saveApplied();
    renderResults();
    return !!state.applied[id];
  }

  /* 관심 탭과 숫자에서 빠진 관심 공고 — 마감됐거나 목록에서 사라진 건. 숫자와 화면이 왜 다른지 설명하고 정리 버튼을 준다. */
  function favStaleHTML(n) {
    return '<p class="fav-stale">접수 마감·목록에서 빠진 관심 공고 <b>' + n + '건</b>은 관심 숫자에 넣지 않았어요.' +
      '<button type="button" class="fav-stale-btn" data-fav-clean>정리하기</button></p>';
  }

  function emptyHTML() {
    if (state.filter === 'fav') {
      var stale = staleFavIds().length;
      if (stale) {
        return '<div class="empty"><div class="empty-emoji">🗓️</div>' +
          '<p class="empty-title">관심 공고 ' + stale + '건이 모두 접수 마감됐어요</p>' +
          '<p class="empty-copy">접수 마감·목록에서 빠진 공고는 <b>관심 숫자에도 넣지 않아요</b>.<br>' +
          '카드의 <b>관심</b>을 눌러 지금 접수 중인 공고를 담아 두세요.</p>' +
          '<button type="button" class="empty-btn empty-btn--ghost" data-fav-clean>마감된 관심 공고 정리</button></div>';
      }
      return '<div class="empty"><div class="empty-emoji">🤍</div>' +
        '<p class="empty-title">아직 담은 공고가 없어요</p>' +
        '<p class="empty-copy">카드의 <b>관심</b>을 눌러 두면<br>발표일이 겹치는지 한 번에 확인해 드려요.</p></div>';
    }
    if (!counts().total) {
      return '<div class="empty"><div class="empty-emoji">🗓️</div>' +
        '<p class="empty-title">지금은 접수 중인 공고가 없어요</p>' +
        '<p class="empty-copy">접수가 끝난 공고는 목록에서 빠집니다.<br>매일 오전 10시에 새 공고를 다시 받아와요.</p></div>';
    }
    if (state.filter === 'excluded') {
      return '<div class="empty"><div class="empty-emoji">🎉</div>' +
        '<p class="empty-title">조건 미달 공고가 없어요</p>' +
        '<p class="empty-copy">지금 조건으로 전국 공고를 모두 검토했어요.</p></div>';
    }
    return '<div class="empty"><div class="empty-emoji">🔍</div>' +
      '<p class="empty-title">지금 조건에 맞는 공고가 없어요</p>' +
      '<p class="empty-copy">주택 수·거주지·예치금을 바꾸면<br>신청 가능한 공고가 나타날 수 있어요.</p>' +
      '<button type="button" class="empty-btn" data-edit-cond>조건 바꾸기</button></div>';
  }

  function renderOverlap() {
    var cm = conflictMap();
    var keys = Object.keys(cm.groups).filter(function (k) { return cm.groups[k].length > 1; });
    var host = $('#overlapBanner');

    if (keys.length) {
      var rows = keys.sort().map(function (k) {
        var names = cm.groups[k].map(function (L) { return L.name; });
        return '<p class="overlap-item"><b>' + mdw(k) + '</b> ' + esc(names.join(' · ')) +
          ' — 발표일이 같아 1인 1건만 신청할 수 있어요.</p>';
      }).join('');
      host.innerHTML = '<div class="overlap" role="status">' +
        '<span class="overlap-ico">!</span>' +
        '<div class="overlap-body">' +
          '<p class="overlap-title">당첨자 발표일이 겹칩니다 — 1곳만 유효해요</p>' +
          '<div class="overlap-list">' + rows + '</div>' +
        '</div></div>';
      return;
    }
    if (favCount() >= 2) {
      host.innerHTML = '<div class="overlap overlap-ok" role="status">' +
        '<span class="overlap-ico">✓</span>' +
        '<div class="overlap-body">' +
          '<p class="overlap-title">관심 ' + favCount() + '곳 — 발표일이 모두 달라요</p>' +
          '<p class="overlap-item">발표일이 다르면 각각 신청할 수 있어요. 다만 빠른 공고에 당첨되면 늦은 공고 당첨은 자동 취소돼요.</p>' +
        '</div></div>';
      return;
    }
    host.innerHTML = '';
  }

  function renderInterestBar() {
    var bar = $('#interestBar');
    /* 하단 바 숫자도 화면에 보이는 관심 카드 수와 같다 — 마감된 공고만 남았으면 바 자체를 띄우지 않는다 */
    if (!favCount()) { bar.hidden = true; return; }
    bar.hidden = false;
    var cm = conflictMap();
    var conflictCount = Object.keys(cm.groups).filter(function (k) { return cm.groups[k].length > 1; }).length;
    $('#ibCount').textContent = favCount();
    /* 진행률은 연속 신청 모드와 같게 — 접수 예정·조건 미달 공고는 분모에서 뺀다 */
    var aptIds = favEntries().filter(canApplyNow).map(function (e) { return e.l.id; });
    var appliedN = aptIds.filter(function (id) { return !!state.applied[id]; }).length;
    $('#ibSub').textContent = (conflictCount
      ? '발표일 겹침 ' + conflictCount + '쌍 — 확인이 필요해요'
      : '발표일이 겹치는 공고가 없어요') +
      (appliedN ? ' · 신청 완료 ' + appliedN + '/' + aptIds.length : '');
  }

  /* ───────────────────────── 드로어 ───────────────────────── */
  function timelineHTML(L, st) {
    var wd = L.winnersDate ? parseDate(L.winnersDate) : null;
    var wdLeft = wd ? diffDays(wd, startOfToday()) : null;
    var rows = [
      { k: '모집공고', v: L.announceDate ? md(L.announceDate) : '공고문 확인', side: '' },
      { k: '접수', v: L.applyDates || '공고문 확인', side: st.key === 'closed' ? '마감' : (L.applyStart ? md(L.applyStart) + '~' + md(L.applyEnd) : '') },
      { k: '당첨자 발표', v: L.winnersDate ? mdw(L.winnersDate) : '발표일 미정',
        side: wdLeft === null ? '' : (wdLeft < 0 ? '발표 완료' : wdLeft === 0 ? '오늘 발표' : 'D-' + wdLeft) },
      { k: '계약', v: L.contractStart ? mdw(L.contractStart) : '공고문 확인', side: L.contractStart ? '발표 후' : '' },
      { k: '입주', v: L.moveIn || '공고문 확인', side: '' }
    ];
    return rows.map(function (r) {
      return '<div class="d-tl-row"><span class="d-tl-label">' + r.k + '</span>' +
        '<span class="d-tl-value">' + esc(r.v) + '</span>' +
        '<span class="d-tl-side">' + esc(r.side) + '</span></div>';
    }).join('');
  }

  function typesHTML(L) {
    if (!L.types || !L.types.length) {
      return '<p class="fund-note">' + esc(L.priceRange || '공급 금액은 공고문·사업주체 문의로 확인해야 합니다.') + '</p>';
    }
    return '<table class="d-table"><thead><tr><th>주택형</th><th>공급 금액(최고가)</th></tr></thead><tbody>' +
      L.types.map(function (t) {
        return '<tr><td>' + esc(t.label) + '</td><td>' + esc(num(t.price)) + '만</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function evidenceHTML(L) {
    var ev = L.evidence || {};
    var rows = [], seen = [];
    function add(k, v) {
      if (!v) return;
      var key = String(v).replace(/\s+/g, ' ').slice(0, 60);
      if (seen.indexOf(key) !== -1) return;
      seen.push(key);
      rows.push({ k: k, v: v });
    }
    add('주택 수', ev.housing);
    add('공고문 문구', ev.housing_alt);
    add('거주지', ev.residence);
    add('재당첨·전매', L.ruleNote);
    if (!rows.length) return '';
    return '<div class="d-quote">' + rows.map(function (r) {
      return '<p class="d-quote-row"><b>' + esc(r.k) + '</b> ' + esc(r.v) + '</p>';
    }).join('') + '</div>';
  }

  function drawerHTML(e) {
    var L = e.l, st = e.status;
    var isFav = state.favs.indexOf(L.id) !== -1;
    var cta = applyMeta(L, st, e.ok);
    var verdictLines = (e.ok ? e.passes : e.fails).slice(0, 5).map(function (x) {
      var line = typeof x === 'string' ? x : x.text;
      return '<p class="dv-line">' + (e.ok ? '✓ ' : '✕ ') + esc(line) + '</p>';
    }).join('');
    var warnLines = e.warns.length
      ? '<div class="d-tip">' + e.warns.map(function (w) { return '· ' + esc(w); }).join('<br>') + '</div>'
      : '';

    var depositCell = L.requiredDeposit > 0
      ? num(L.requiredDeposit) + '만 원' + (state.deposit < L.requiredDeposit
        ? ' <b style="color:var(--no)">(부족 ' + num(L.requiredDeposit - state.deposit) + '만 원)</b>' : ' (충족)')
      : '요건 없음';

    var sourceLinks = '';
    if (L.pdfUrl) sourceLinks += '<a class="d-link" href="' + esc(L.pdfUrl) + '" target="_blank" rel="noopener">입주자모집공고문 PDF 열기 ↗</a>';
    if (L.detailUrl) {
      sourceLinks += '<a class="d-link" href="' + esc(L.detailUrl) + '" target="_blank" rel="noopener">청약홈 공고 상세 ↗</a>';
    } else {
      sourceLinks += '<a class="d-link" href="https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do" target="_blank" rel="noopener">청약홈에서 공고 검색 ↗</a>';
    }
    if (L.applyUrl) {
      if (cta.kind === 'apply') {
        sourceLinks += '<a class="d-link" href="' + esc(L.applyUrl) + '" target="_blank" rel="noopener">청약신청 화면 ↗</a>';
      } else if (st.key === 'open') {
        /* 접수 시간 밖에는 신청 화면으로 가는 링크를 열지 않는다 */
        sourceLinks += '<span class="d-link d-link--off">청약신청 화면 — 접수 시간(평일 09:00~17:30)에 열려요</span>';
      }
    }

    return '' +
      '<div class="drawer-head">' +
        '<div class="drawer-head-top">' +
          '<div class="card-chips">' +
            '<span class="chip chip-region">' + esc(L.region) + '</span>' +
            '<span class="chip chip-type">' + esc(L.supplyType) + '</span>' +
            '<span class="' + ddayClass(st) + '">' + esc(st.label) + '</span>' +
          '</div>' +
          '<button type="button" class="drawer-close" id="drawerClose" aria-label="닫기">✕</button>' +
        '</div>' +
        '<h2 class="drawer-title" id="drawerTitle">' + esc(L.name) + '</h2>' +
        '<p class="drawer-loc">' + esc(L.region) + ' ' + esc(L.district || '') + ' · ' +
          esc(L.units ? num(L.units) + '세대' : '물량 미확인') + '</p>' +
        '<div class="drawer-verdict ' + (e.ok ? 'ok' : 'no') + '">' +
          '<p class="dv-title">' + (e.ok ? '✓ 내 조건으로 지원 가능' : '✕ 내 조건으로는 ' + e.fails.length + '가지 미달') + '</p>' +
          verdictLines +
        '</div>' +
      '</div>' +
      '<div class="drawer-body-inner">' +
        applyBoxHTML(e) +
        '<section class="d-sec">' +
          '<h3 class="d-sec-title">공고문 원문 근거</h3>' +
          evidenceHTML(L) +
          warnLines +
        '</section>' +
        '<section class="d-sec">' +
          '<h3 class="d-sec-title">일정</h3>' +
          '<div class="d-timeline">' + timelineHTML(L, st) + '</div>' +
        '</section>' +
        '<section class="d-sec">' +
          '<h3 class="d-sec-title">공급 금액</h3>' +
          typesHTML(L) +
        '</section>' +
        incomeAssetHTML(L) +
        '<section class="d-sec">' +
          '<h3 class="d-sec-title">신청 전 확인</h3>' +
          '<dl class="d-dl">' +
            '<div class="d-dl-row"><dt>주택 수 요건</dt><dd>' + esc(L.housingRequirement) + '</dd></div>' +
            '<div class="d-dl-row"><dt>청약통장 예치금</dt><dd>' + depositCell + '</dd></div>' +
            '<div class="d-dl-row"><dt>예치금 기준</dt><dd>' + esc(L.depositNote || '') + '</dd></div>' +
            '<div class="d-dl-row"><dt>거주지 요건</dt><dd>' +
              esc(L.residenceRequirement) + (L.eligibleRegions && L.eligibleRegions.length && L.residenceRequirement !== '전국'
                ? ' — ' + esc(regionLabel(L.eligibleRegions)) : '') +
              (L.priorityRegions && L.priorityRegions.length ? ' (우선 ' + esc(regionLabel(L.priorityRegions)) + ')' : '') +
            '</dd></div>' +
            '<div class="d-dl-row"><dt>세대주 조건</dt><dd>' +
              (L.householderOnly === true ? '무주택세대의 세대주만 가능'
                : L.householderOnly === false ? '세대주·세대원 모두 가능' : '공고문 확인') + '</dd></div>' +
            '<div class="d-dl-row"><dt>시행·시공</dt><dd>' + esc(L.builder || '—') + '</dd></div>' +
            '<div class="d-dl-row"><dt>문의처</dt><dd>' + esc(L.tel || '—') + '</dd></div>' +
          '</dl>' +
        '</section>' +
        '<section class="d-sec">' +
          '<h3 class="d-sec-title">원문 보기</h3>' +
          '<div class="d-links">' + sourceLinks + '</div>' +
          '<p class="d-source">출처 · 청약홈(applyhome.co.kr) ' + esc(L.source) + '<br>최종 자격과 일정은 공고문 원문으로 확인하세요.</p>' +
        '</section>' +
      '</div>' +
      '<div class="drawer-actions">' +
        '<button type="button" class="btn-secondary" id="drawerFav" aria-pressed="' + isFav + '">' +
          (isFav ? '관심 담김 ✓' : '관심 담기') + '</button>' +
        (cta.kind === 'apply'
          ? '<a class="btn-primary" href="' + esc(cta.url) + '" target="_blank" rel="noopener">' + esc(cta.short) + '</a>'
          : '<span class="btn-primary btn-primary--off" aria-disabled="true">' + esc(cta.short) + '</span>') +
      '</div>';
  }

  function openDrawer(id) {
    var e = null;
    for (var i = 0; i < evalCache.length; i++) if (evalCache[i].l.id === id) { e = evalCache[i]; break; }
    if (!e) return;
    lastFocus = document.activeElement;
    var d = $('#drawer');
    d.innerHTML = drawerHTML(e);
    d.setAttribute('data-id', id);
    d.scrollTop = 0;
    d.hidden = false;
    $('#backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    var close = $('#drawerClose');
    if (close) close.focus();
  }

  function closeDrawer() {
    var d = $('#drawer');
    if (d.hidden) return;
    d.hidden = true;
    d.innerHTML = '';
    d.removeAttribute('data-id');
    $('#backdrop').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ───────────────────────── 관심 ───────────────────────── */
  function toggleFav(id) {
    var i = state.favs.indexOf(id);
    if (i === -1) state.favs.push(id);
    else state.favs.splice(i, 1);
    save();
    renderResults();
    return state.favs.indexOf(id) !== -1;
  }

  /* ───────────────────────── 토스트 ───────────────────────── */
  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, ms || 2400);
  }

  /* ───────────────────────── 미니 바 ───────────────────────── */
  function setupMiniBar() {
    var card = $('#condCard');
    var bar = $('#miniBar');
    var ticking = false;
    function check() {
      ticking = false;
      var rect = card.getBoundingClientRect();
      var threshold = Math.min(180, window.innerHeight * 0.25);
      var show = rect.bottom < threshold && window.innerWidth < 980;
      if (show !== !bar.hidden) bar.hidden = !show;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    window.addEventListener('resize', check);
    check();
  }

  function refresh() {
    renderCondition();
    evaluateAll();
    renderResults();
  }

  /* ───────────────────────── 이벤트 ───────────────────────── */
  function bind() {
    document.addEventListener('click', function (ev) {
      /* 청약홈 링크는 새 창으로 열고, 카드 상세(드로어)는 열지 않는다 */
      if (ev.target.closest('[data-apply]')) return;

      /* 접수 시간 밖 안내 — 신청 화면으로도, 드로어로도 넘어가지 않고 언제 열리는지만 알린다 */
      if (ev.target.closest('[data-time-note]')) {
        ev.preventDefault();
        ev.stopPropagation();
        var tg = applyGate();
        toast(tg.head + ' · ' + tg.tip, 4200);
        return;
      }

      var seg = ev.target.closest('[data-seg]');
      if (seg) {
        var key = seg.getAttribute('data-seg');
        var val = seg.getAttribute('data-value');
        if (state[key] !== val) { state[key] = val; save(); refresh(); }
        return;
      }

      var reg = ev.target.closest('[data-region]');
      if (reg) {
        var rv = reg.getAttribute('data-region');
        if (state.residence !== rv) { state.residence = rv; save(); refresh(); }
        return;
      }

      var dep = ev.target.closest('[data-dep]');
      if (dep) {
        setDeposit(Number(dep.getAttribute('data-dep')));
        return;
      }

      var fbtn = ev.target.closest('[data-filter]');
      if (fbtn) { state.filter = fbtn.getAttribute('data-filter'); renderResults(); return; }

      var seqCheck = ev.target.closest('[data-seq-check]');
      if (seqCheck) {
        var sNow = toggleApplied(seqCheck.getAttribute('data-seq-check'));
        toast(sNow ? '신청 완료로 체크했어요' : '체크를 지웠어요');
        return;
      }
      var seqDetail = ev.target.closest('[data-seq-detail]');
      if (seqDetail) { openDrawer(seqDetail.getAttribute('data-seq-detail')); return; }
      if (ev.target.closest('#seqReset')) {
        state.favs.forEach(function (id) { delete state.applied[id]; });
        saveApplied();
        renderResults();
        toast('신청 완료 체크를 모두 지웠어요');
        return;
      }
      if (ev.target.closest('#ibSeqBtn')) {
        state.filter = 'fav';
        renderResults();
        var seqHost = $('#seqPanel');
        (seqHost && !seqHost.hidden ? seqHost : $('#cards')).scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      var hhBtn = ev.target.closest('[data-ia-hh]');
      if (hhBtn) {
        iaHousehold = Number(hhBtn.getAttribute('data-ia-hh')) || 0;
        var did = $('#drawer').getAttribute('data-id');
        var de = null;
        for (var k = 0; k < evalCache.length; k++) if (evalCache[k].l.id === did) { de = evalCache[k]; break; }
        if (de) {
          var sc = $('#drawer').scrollTop;
          $('#drawer').innerHTML = drawerHTML(de);
          $('#drawer').setAttribute('data-id', did);
          $('#drawer').scrollTop = sc;
        }
        return;
      }

      var favBtn = ev.target.closest('[data-fav]');
      if (favBtn) {
        ev.stopPropagation();
        var nowFav = toggleFav(favBtn.getAttribute('data-fav'));
        toast(nowFav ? '관심 공고에 담았어요' : '관심에서 뺐어요');
        return;
      }

      /* 마감·목록에서 빠진 관심 공고 정리 — 화면에 없는 ID를 favs에서 지운다 */
      if (ev.target.closest('[data-fav-clean]')) {
        var stale = staleFavIds();
        if (!stale.length) return;
        state.favs = state.favs.filter(function (id) { return stale.indexOf(id) === -1; });
        stale.forEach(function (id) { delete state.applied[id]; });
        save();
        saveApplied();
        renderResults();
        toast('마감된 관심 공고 ' + stale.length + '건을 정리했어요');
        return;
      }

      var card = ev.target.closest('.card');
      if (card) { openDrawer(card.getAttribute('data-id')); return; }

      if (ev.target.closest('[data-edit-cond]')) {
        $('#condCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (ev.target.id === 'miniEdit' || ev.target.closest('#miniEdit')) {
        $('#condCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (ev.target.id === 'drawerClose' || ev.target.id === 'drawerClose2' || ev.target.id === 'backdrop') {
        closeDrawer();
        return;
      }
      if (ev.target.id === 'drawerFav') {
        var id = $('#drawer').getAttribute('data-id');
        if (id) {
          var on = toggleFav(id);
          ev.target.setAttribute('aria-pressed', on);
          ev.target.textContent = on ? '관심 담김 ✓' : '관심 담기';
          var e2 = null;
          for (var i = 0; i < evalCache.length; i++) if (evalCache[i].l.id === id) { e2 = evalCache[i]; break; }
          if (e2) {
            var scroll = $('#drawer').scrollTop;
            $('#drawer').innerHTML = drawerHTML(e2);
            $('#drawer').setAttribute('data-id', id);
            $('#drawer').scrollTop = scroll;
          }
          toast(on ? '관심 공고에 담았어요' : '관심에서 뺐어요');
        }
        return;
      }
      if (ev.target.id === 'ibBtn') {
        state.filter = 'fav';
        renderResults();
        var target = $('#overlapBanner').children.length ? $('#overlapBanner') : $('#cards');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    });

    $('#depositRange').addEventListener('input', function (ev) {
      setDeposit(Number(ev.target.value));
    });
    $('#depositRange').addEventListener('change', function () { save(); });

    /* 원 단위 직접 입력 — 타이핑하는 동안은 입력칸 글자를 그대로 두고 판정만 갱신한다 */
    var dInput = $('#depositInput');
    dInput.addEventListener('input', function (ev) {
      setDeposit(parseWon(ev.target.value), { keepInput: true });
    });
    dInput.addEventListener('blur', function () {
      dInput.value = state.deposit ? num(state.deposit) : '';
    });
    dInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); dInput.blur(); }
    });

    $('#sortSel').addEventListener('change', function (ev) {
      state.sort = ev.target.value;
      renderResults();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeDrawer();
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('card')) {
        ev.preventDefault();
        openDrawer(ev.target.getAttribute('data-id'));
      }
    });
  }

  /* ─────────────── 접수 시간·날자가 바뀌면 화면을 다시 그린다 ─────────────── */
  var lastGateOpen = null;
  var lastIso = null;
  function redrawOpenDrawer() {
    var d = $('#drawer');
    if (!d || d.hidden) return;
    var id = d.getAttribute('data-id');
    var e = null;
    for (var i = 0; i < evalCache.length; i++) if (evalCache[i].l.id === id) { e = evalCache[i]; break; }
    if (!e) return;
    var sc = d.scrollTop;
    d.innerHTML = drawerHTML(e);
    d.setAttribute('data-id', id);
    d.scrollTop = sc;
  }
  function tickClock() {
    var g = applyGate();
    var open = g.open;
    if (lastIso !== null && g.iso !== lastIso) {
      /* 날짜가 바뀌면 어제까지 접수하던 공고가 목록에서 빠지도록 다시 그린다 */
      lastIso = g.iso;
      lastGateOpen = open;
      refresh();
      redrawOpenDrawer();
      return;
    }
    lastIso = g.iso;
    if (lastGateOpen !== null && open !== lastGateOpen) {
      lastGateOpen = open;
      refresh();
      redrawOpenDrawer();
      return;
    }
    lastGateOpen = open;
    renderApplyWindow();
  }
  function startClock() {
    lastGateOpen = applyGate().open;
    lastIso = applyGate().iso;
    setInterval(tickClock, 20000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tickClock();
    });
  }

  /* ───────────────────────── 시작 ───────────────────────── */
  function boot(data) {
    LISTINGS = data.listings || [];
    META = data.meta || {};
    /* 검증용 훅 — 현재 접수 시간 판정을 그대로 돌려준다(화면에는 영향 없음) */
    window.__CHEONGYAK_GATE__ = applyGate;

    $('#hdrCount').textContent = LISTINGS.length;
    if (META.collectedAt) {
      $('#hdrDate').textContent = META.collectedAt.replace(/-/g, '.');
      $('#footDate').textContent = META.collectedAt;
    }

    load();
    /* favs에는 예전에 담아 둔 ID가 남아 있을 수 있다(마감·목록에서 빠진 공고).
       화면·숫자는 favEntries()가 걸러 내고, 남은 ID는 관심 탭의 '정리하기'로 사용자가 지운다. */
    renderCondition();
    evaluateAll();
    renderResults();
    setupMiniBar();
    bind();
    startClock();
  }

  function fail(msg) {
    $('#cards').innerHTML = '<div class="empty"><div class="empty-emoji">⚠️</div>' +
      '<p class="empty-title">공고 데이터를 불러오지 못했어요</p>' +
      '<p class="empty-copy">' + esc(msg) + '<br>로컬 서버에서 열어 주세요: <b>python3 -m http.server</b></p></div>';
  }

  if (window.__CHEONGYAK_DATA__) {
    boot(window.__CHEONGYAK_DATA__);
  } else {
    fetch('data/listings.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(boot)
      .catch(function (e) {
        fail('data/listings.json 을 읽을 수 없습니다 (' + e.message + ')');
      });
  }
})();
