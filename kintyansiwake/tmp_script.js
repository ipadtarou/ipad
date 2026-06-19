
// ===== 状態 =====
const categories = ['cap','label','shred','bottle','paper'];
const keyToLabel = {
  cap: '🔵 ボトルキャップ',
  label: '🏷 ラベル',
  shred: '🗑 シュレッダー',
  bottle: '🧴 ペットボトル',
  paper: '📦 段ボール',
};
const idMap = {
  cap: 'Cap',
  label: 'Label',
  shred: 'Shred',
  bottle: 'Bottle',
  paper: 'Paper',
};
const pageKeys = [['cap','label','shred'], ['bottle','paper']];

const state = {
  cap:   { total: 0, prev: 0, count: 0, img: 'c.jpg', curEl: null, prevEl: null, dispEl: null, bulbEl: null },
  label: { total: 0, prev: 0, count: 0, img: 'r.jpg', curEl: null, prevEl: null, dispEl: null, bulbEl: null },
  shred: { total: 0, prev: 0, count: 0, img: 's.jpg', curEl: null, prevEl: null, dispEl: null, bulbEl: null },
  bottle:{ total: 0, prev: 0, count: 0, img: 'c.jpg', curEl: null, prevEl: null, dispEl: null, bulbEl: null },
  paper: { total: 0, prev: 0, count: 0, img: 'r.jpg', curEl: null, prevEl: null, dispEl: null, bulbEl: null },
};

let currentPage = 0;
let activeCol = null;
let idleTimer = null;
let overlayActive = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playKasouSE() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = freq; osc.type = 'square';
    const t = audioCtx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t); osc.stop(t + 0.1);
  });
}

function stopAllSE() {
  document.getElementById('sndSeikou').pause();
  document.getElementById('sndSippai').pause();
}

function resetIdleTimer(key) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const k = overlayActive || key;
    const s = state[k];
    if (s && s.count < s.total) {
      const el = document.getElementById('sndSippai');
      el.currentTime = 0; el.play();
    }
  }, 3000);
}

// ===== 画面1 → 画面2 =====
document.getElementById('btnStart').addEventListener('click', startScreen2);

function startScreen2() {
  const v = id => parseInt(document.getElementById(id).value) || 0;
  state.cap.total    = v('capTotal');
  state.cap.prev     = v('capPrev1');
  state.label.total  = v('labelTotal');
  state.label.prev   = v('labelPrev1');
  state.shred.total  = v('shredTotal');
  state.shred.prev   = v('shredPrev1');
  state.bottle.total = v('bottleTotal');
  state.bottle.prev  = v('bottlePrev1');
  state.paper.total  = v('paperTotal');
  state.paper.prev   = v('paperPrev1');

  state.cap.curEl     = document.getElementById('curColCap');
  state.cap.prevEl    = document.getElementById('prevColCap');
  state.cap.dispEl    = document.getElementById('dispCap');
  state.cap.bulbEl    = document.getElementById('bulbCap');
  state.label.curEl   = document.getElementById('curColLabel');
  state.label.prevEl  = document.getElementById('prevColLabel');
  state.label.dispEl  = document.getElementById('dispLabel');
  state.label.bulbEl  = document.getElementById('bulbLabel');
  state.shred.curEl   = document.getElementById('curColShred');
  state.shred.prevEl  = document.getElementById('prevColShred');
  state.shred.dispEl  = document.getElementById('dispShred');
  state.shred.bulbEl  = document.getElementById('bulbShred');
  state.bottle.curEl  = document.getElementById('curColBottle');
  state.bottle.prevEl = document.getElementById('prevColBottle');
  state.bottle.dispEl = document.getElementById('dispBottle');
  state.bottle.bulbEl = document.getElementById('bulbBottle');
  state.paper.curEl   = document.getElementById('curColPaper');
  state.paper.prevEl  = document.getElementById('prevColPaper');
  state.paper.dispEl  = document.getElementById('dispPaper');
  state.paper.bulbEl  = document.getElementById('bulbPaper');

  document.getElementById('screen1').style.display = 'none';
  document.getElementById('screen2').style.display = 'block';

  categories.forEach(key => {
    fillPrevCol(state[key].prevEl, state[key]);
    setupSlots(state[key].curEl, state[key]);
    buildBulbs(state[key].bulbEl);
    updateDisp(key);
  });
  currentPage = 0;
  updatePageView();
  setupClickSelect();
  setupButtons();
  setupKeyboard();
}

function fillPrevCol(colEl, s) {
  colEl.querySelectorAll('img').forEach(e => e.remove());
  const n = Math.max(0, s.prev);
  for (let i = 0; i < n; i++) {
    const img = document.createElement('img');
    img.src = s.img; img.className = 'stack-img prev';
    colEl.insertBefore(img, colEl.querySelector('.stack-col-label'));
  }
}

// スロット（空枠）をtotal個分生成。一番上（最後）にgoal-line
function setupSlots(colEl, s) {
  colEl.querySelectorAll('.slot,.cur-item').forEach(e => e.remove());
  for (let i = 0; i < s.total; i++) {
    const d = document.createElement('div');
    // flex-direction:column-reverse なので appendChild で下から上に積まれる
    // 最後にappendしたものが一番上 → total-1番目がgoal-line
    d.className = 'slot' + (i === s.total - 1 ? ' goal-line' : '');
    colEl.appendChild(d);
  }
}

// 電球をcurColの縦幅に合わせてcurCol内の周囲に配置
function buildBulbs(wrap) {
  wrap.innerHTML = '';
  // 通常時は薄い電球を外枠に沿って配置（inset:0）
  const n = 16;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('div');
    b.className = 'bulb';
    const side = Math.floor(i / 4);
    const pos  = (i % 4) / 3;
    if (side === 0)      { b.style.top = '0%';   b.style.left = (pos * 100) + '%'; }
    else if (side === 1) { b.style.left = '100%'; b.style.top  = (pos * 100) + '%'; }
    else if (side === 2) { b.style.top = '100%';  b.style.left = ((1 - pos) * 100) + '%'; }
    else                 { b.style.left = '0%';   b.style.top  = ((1 - pos) * 100) + '%'; }
    b.style.animationDelay = (i * 0.075) + 's';
    wrap.appendChild(b);
  }
}

// 合格時：積み上がった画像群の実サイズを測って電球を密着配置
function repositionBulbs(wrap, colEl) {
  const imgs = colEl.querySelectorAll('.cur-item .stack-img');
  if (!imgs.length) return;
  const colRect  = colEl.getBoundingClientRect();
  const first    = imgs[0].getBoundingClientRect();   // 一番下の画像
  const last     = imgs[imgs.length - 1].getBoundingClientRect(); // 一番上

  // curCol内の相対座標に変換
  const top    = last.top  - colRect.top;
  const bottom = first.bottom - colRect.top;
  const left   = last.left - colRect.left;
  const right  = first.right - colRect.left;
  const w = right - left;
  const h = bottom - top;

  wrap.innerHTML = '';
  // 上下4個・左右8個 = 24個を1周として角の重複なしに配置
  const sides = [
    { count: 4, fn: (t) => ({ bx: left + t * w, by: top }) },       // 上
    { count: 8, fn: (t) => ({ bx: right,          by: top + t * h }) }, // 右
    { count: 4, fn: (t) => ({ bx: right - t * w,  by: bottom }) },   // 下
    { count: 8, fn: (t) => ({ bx: left,            by: bottom - t * h }) }, // 左
  ];
  let delay = 0;
  const total = sides.reduce((s, x) => s + x.count, 0);
  sides.forEach(({ count, fn }) => {
    for (let i = 0; i < count; i++) {
      const b = document.createElement('div');
      b.className = 'bulb';
      const { bx, by } = fn((i + 0.5) / count); // 0.5オフセットで角を避ける
      b.style.left = bx + 'px';
      b.style.top  = by + 'px';
      b.style.animationDelay = (delay / total * 0.6) + 's';
      delay++;
      wrap.appendChild(b);
    }
  });
}

function addCurrentImg(colEl, imgSrc, isSeikou) {
  const slot = colEl.querySelector('.slot');
  const num = colEl.querySelectorAll('.cur-item').length + 1;
  const wrap = document.createElement('div');
  wrap.className = 'cur-item';
  const img = document.createElement('img');
  img.src = imgSrc;
  img.className = 'stack-img current' + (isSeikou ? ' seikou' : '');
  const span = document.createElement('span');
  span.className = 'cur-num';
  span.textContent = num;
  wrap.appendChild(img);
  wrap.appendChild(span);
  if (slot) {
    colEl.replaceChild(wrap, slot);
  } else {
    colEl.appendChild(wrap);
  }
}

function triggerSeikou(key) {
  const s = state[key];
  const curEl  = overlayActive === key ? document.getElementById('overlayCur') : s.curEl;
  const bulbEl = overlayActive === key ? document.getElementById('bulbOverlay') : s.bulbEl;
  curEl.querySelectorAll('.cur-item .stack-img').forEach(el => el.classList.add('seikou'));
  curEl.classList.add('seikou');
  requestAnimationFrame(() => {
    repositionBulbs(bulbEl, curEl);
    bulbEl.classList.add('seikou');
  });
  // 成功バナー表示
  const bannerId = 'banner' + idMap[key];
  const rnumId   = 'rnum' + idMap[key];
  const banner = document.getElementById(bannerId);
  if (banner) {
    banner.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style="font-size:clamp(1rem,3vw,2rem);color:#aaa">${keyToLabel[key]}</span>
      <span class="rnum" id="${rnumId}">${s.total}</span>
    </div>`;
    banner.classList.add('show');
  }
}

// ===== カウント処理 =====
function doCount(key) {
  const s = state[key];
  if (s.count >= s.total) return;
  s.count++;

  const curEl = overlayActive === key
    ? document.getElementById('overlayCur')
    : s.curEl;

  const isSeikou = s.count === s.total;
  addCurrentImg(curEl, s.img, isSeikou);

  if (isSeikou) {
    stopAllSE(); clearTimeout(idleTimer);
    triggerSeikou(key);
    setTimeout(() => { const e = document.getElementById('sndSeikou'); e.currentTime=0; e.play(); }, 200);
  } else {
    playKasouSE();
    resetIdleTimer(key);
  }

  updateDisp(key);
  if (overlayActive === key) updateOverlayDisp(key);
}

function updateDisp(key) {
  const s = state[key];
  s.dispEl.textContent = `${s.count} / ${s.total}`;
}
function updateOverlayDisp(key) {
  const s = state[key];
  document.getElementById('overlayDisp').textContent = `${s.count} / ${s.total}`;
}

// ===== クリック選択 =====
function setupClickSelect() {
  categories.forEach(key => {
    document.getElementById('img' + idMap[key]).parentElement.addEventListener('click', () => selectCol(key));
  });
}

function selectCol(key) {
  categories.forEach(k => {
    document.getElementById('img' + idMap[k]).classList.remove('selected');
  });
  activeCol = key;
  document.getElementById('img' + idMap[key]).classList.add('selected');
}

function setupButtons() {
  categories.forEach(key => {
    document.getElementById('btn' + idMap[key]).addEventListener('click', () => {
      selectCol(key);
      doCount(key);
    });
  });
}

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && activeCol) { e.preventDefault(); doCount(activeCol); }
  });
}

function updatePageView() {
  categories.forEach(key => {
    const col = document.getElementById('col' + idMap[key]);
    if (!col) return;
    col.style.display = pageKeys[currentPage].includes(key) ? 'flex' : 'none';
  });

  if (!pageKeys[currentPage].includes(activeCol)) {
    activeCol = null;
    categories.forEach(k => document.getElementById('img' + idMap[k]).classList.remove('selected'));
  }

  document.getElementById('pageInfo').textContent = `${currentPage + 1} / ${pageKeys.length}`;
  document.getElementById('pagePrev').disabled = currentPage === 0;
  document.getElementById('pageNext').disabled = currentPage === pageKeys.length - 1;
}

function changePage(delta) {
  currentPage = Math.min(pageKeys.length - 1, Math.max(0, currentPage + delta));
  updatePageView();
}

function togglePrev(key) {
  const s = state[key];
  const prevEl = s.prevEl;
  const btnId  = 'btnTog' + idMap[key];
  const hidden = prevEl.style.display === 'none';
  prevEl.style.display = hidden ? '' : 'none';
  document.getElementById(btnId).textContent = hidden ? '前回 非表示' : '前回 表示';
  // 合格済みなら電球を再配置
  if (s.count === s.total) {
    const curEl  = s.curEl;
    const bulbEl = s.bulbEl;
    requestAnimationFrame(() => {
      repositionBulbs(bulbEl, curEl);
      bulbEl.classList.add('seikou');
    });
  }
}

// ===== 拡大 =====
function openOverlay(key) {
  overlayActive = key;
  const s = state[key];
  document.getElementById('overlayTitle').textContent = keyToLabel[key];
  document.getElementById('overlayImg').src = s.img;

  const prevEl = document.getElementById('overlayPrev');
  const curEl  = document.getElementById('overlayCur');
  const bulbEl = document.getElementById('bulbOverlay');

  fillPrevCol(prevEl, s);
  setupSlots(curEl, s);
  buildBulbs(bulbEl);
  if (s.count === s.total) {
    bulbEl.classList.add('seikou');
    curEl.classList.add('seikou');
  } else {
    bulbEl.classList.remove('seikou');
    curEl.classList.remove('seikou');
  }

  for (let i = 0; i < s.count; i++) addCurrentImg(curEl, s.img, i === s.total - 1 && s.count === s.total);
  if (s.count === s.total) curEl.querySelectorAll('.cur-item .stack-img').forEach(el => el.classList.add('seikou'));

  updateOverlayDisp(key);
  document.getElementById('overlayBtn').onclick = () => doCount(key);
  document.getElementById('overlayImg').onclick = () => doCount(key);
  document.getElementById('overlay').style.display = 'flex';
  selectCol(key);
}

function closeOverlay() {
  if (overlayActive) {
    const key = overlayActive;
    const s = state[key];
    setupSlots(s.curEl, s);
    if (s.count === s.total) { s.bulbEl.classList.add('seikou'); }
    else s.bulbEl.classList.remove('seikou');
    for (let i = 0; i < s.count; i++) addCurrentImg(s.curEl, s.img, i === s.total - 1 && s.count === s.total);
    if (s.count === s.total) s.curEl.querySelectorAll('.cur-item .stack-img').forEach(el => el.classList.add('seikou'));
    updateDisp(key);
  }
  overlayActive = null;
  document.getElementById('overlay').style.display = 'none';
}
