// ═══════════════════════════════════════════════════
//  НМТ 2026 — app.js
//  Flashcard mode: Лексика + Наголоси
//  Quiz mode:      Фразеологізми
// ═══════════════════════════════════════════════════

const STORAGE_KEY = 'nmt2026_v3';

function loadProg() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveProg(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

// ── UTILS ─────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Uppercase Ukrainian vowel → yellow span
function hilightStress(s) {
  return esc(s).replace(/[АЕЄИІЇОУЮЯ]/g, m => `<span class="stress-mark">${m}</span>`);
}

// ── HOME ──────────────────────────────────────────
function renderHome() {
  const p = loadProg();

  // Stats
  let done = 0, quizBest = 0, quizCount = 0, cardsTotal = 0;
  for (const t of TOPICS) {
    const tp = p[t.id];
    if (!tp) continue;
    if (t.mode === 'flashcard' && tp.seen > 0) { done++; cardsTotal += tp.seen; }
    if (t.mode === 'quiz' && tp.attempts > 0) { done++; quizBest = Math.max(quizBest, Math.round(tp.best / tp.total * 100)); quizCount++; }
  }
  document.getElementById('stat-topics').textContent = `${done}/3`;
  document.getElementById('stat-cards').textContent  = cardsTotal || '0';
  document.getElementById('stat-quiz').textContent   = quizCount ? `${quizBest}%` : '—';

  // Cards
  const grid = document.getElementById('topic-grid');
  grid.innerHTML = '';
  for (const t of TOPICS) {
    const tp   = p[t.id];
    const total = t.mode === 'flashcard' ? t.cards.length : t.questions.length;
    let progPct = 0, scoreLabel = `${total} ${t.mode === 'flashcard' ? 'карток' : 'питань'}`;

    if (tp) {
      if (t.mode === 'flashcard') {
        progPct    = Math.round((tp.known || 0) / total * 100);
        scoreLabel = tp.known ? `Знаю: ${tp.known}/${total}` : `${total} карток`;
      } else {
        progPct    = tp.attempts ? Math.round(tp.best / tp.total * 100) : 0;
        scoreLabel = tp.attempts ? `Рекорд: ${tp.best}/${tp.total}` : `${total} питань`;
      }
    }

    const modeLabel = t.mode === 'flashcard' ? '🃏 Картки' : '🎯 Квіз';
    const modeCls   = t.mode === 'flashcard' ? 'card-mode' : 'quiz-mode';

    const card = document.createElement('div');
    card.className = 'topic-card';
    card.style.setProperty('--c', t.color);
    card.innerHTML = `
      <div class="topic-icon">${t.icon}</div>
      <span class="topic-mode-badge ${modeCls}">${modeLabel}</span>
      <div class="topic-title">${t.title}</div>
      <div class="topic-desc">${esc(t.description)}</div>
      <div class="topic-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${progPct}%"></div></div>
        <span class="topic-score">${scoreLabel}</span>
      </div>`;
    card.addEventListener('click', () => openTopic(t.id));
    grid.appendChild(card);
  }
}

function openTopic(id) {
  const t = TOPICS.find(x => x.id === id);
  if (t.mode === 'flashcard') startFlashcards(t);
  else                         startQuiz(t);
}

// ══════════════════════════════════════════════════
//  FLASHCARD MODE
// ══════════════════════════════════════════════════
let fc = {};   // flashcard state

function startFlashcards(topic, onlyUnknown = false) {
  const cards = onlyUnknown && fc.topicId === topic.id
    ? fc.cards.filter((_, i) => fc.status[i] === 'unknown')
    : shuffle([...topic.cards]);

  fc = {
    topic,
    topicId: topic.id,
    cards,
    idx: 0,
    status: new Array(cards.length).fill('unseen'), // 'unseen'|'known'|'unknown'
    flipped: false,
  };

  const fcTitle = document.getElementById('fc-title');
  fcTitle.textContent = `${topic.icon} ${topic.title}`;
  fcTitle.style.color = topic.color;
  document.getElementById('fc-sub').textContent   = `${topic.cards.length} карток · натисни щоб перегорнути`;

  // Build dots (max 30 visible)
  buildDots();
  show('flashcard-screen');
  renderCard();
}

function buildDots() {
  const dotsEl = document.getElementById('fc-dots');
  dotsEl.innerHTML = '';
  const max = Math.min(fc.cards.length, 40);
  for (let i = 0; i < max; i++) {
    const d = document.createElement('div');
    d.className = 'fc-dot';
    d.id = `dot-${i}`;
    dotsEl.appendChild(d);
  }
}

function renderCard() {
  const c   = fc.cards[fc.idx];
  const isStress = fc.topicId === 'stress';

  // Progress
  document.getElementById('fc-prog').style.width  = `${(fc.idx / fc.cards.length) * 100}%`;
  document.getElementById('fc-count').textContent = `${fc.idx + 1} / ${fc.cards.length}`;

  // Reset flip instantly (no animation)
  const card = document.getElementById('fc-card');
  fc.flipped = false;
  card.style.transition = 'none';
  card.classList.remove('flipped');
  card.offsetHeight; // force reflow so transition disable takes effect
  card.style.transition = '';

  // Front content
  const frontEl = document.getElementById('fc-front');
  const backEl  = document.getElementById('fc-back');

  if (isStress) {
    // Stress card: front = plain word, back = stressed word
    frontEl.innerHTML = `
      <div class="fc-label fc-stress-label">🔊 Наголос</div>
      <div class="fc-word">${esc(c.plain)}</div>
      <div class="fc-hint">Натисни — побачиш правильний наголос</div>`;
    backEl.innerHTML = `
      <div class="fc-label fc-stress-label">✓ Правильно</div>
      <div class="fc-word">${hilightStress(c.stressed)}</div>
      <div class="fc-hint">Жовта літера = наголошений склад</div>`;
  } else {
    // Lexical error card: front = wrong, back = correct
    frontEl.innerHTML = `
      <div class="fc-label fc-wrong-label">❌ Неправильно</div>
      <div class="fc-word">${esc(c.wrong)}</div>
      <div class="fc-hint">Натисни — побачиш правильну форму</div>`;
    backEl.innerHTML = `
      <div class="fc-label fc-correct-label">✅ Правильно</div>
      <div class="fc-word">${esc(c.correct)}</div>
      <div class="fc-hint">Натисни, щоб перегорнути назад</div>`;
  }

  // Update dots
  updateDots();

  // Buttons
  document.getElementById('fc-prev').disabled = fc.idx === 0;
  document.getElementById('fc-next').disabled = fc.idx === fc.cards.length - 1;
  document.getElementById('fc-known').disabled   = false;
  document.getElementById('fc-unknown').disabled = false;
}

function updateDots() {
  const max = Math.min(fc.cards.length, 40);
  for (let i = 0; i < max; i++) {
    const d = document.getElementById(`dot-${i}`);
    if (!d) continue;
    d.className = 'fc-dot' +
      (i === fc.idx          ? ' active'  : '') +
      (fc.status[i] === 'known'   ? ' known'   : '') +
      (fc.status[i] === 'unknown' ? ' unknown' : '');
  }
}

function flipCard() {
  fc.flipped = !fc.flipped;
  document.getElementById('fc-card').classList.toggle('flipped', fc.flipped);
}

function markCard(status) {
  fc.status[fc.idx] = status;
  updateDots();

  // Auto-advance
  if (fc.idx < fc.cards.length - 1) {
    fc.idx++;
    setTimeout(renderCard, 180);
  } else {
    setTimeout(showFcSummary, 250);
  }
}

function showFcSummary() {
  const known   = fc.status.filter(s => s === 'known').length;
  const unknown = fc.status.filter(s => s === 'unknown').length;
  const unseen  = fc.status.filter(s => s === 'unseen').length;
  const total   = fc.cards.length;
  const pct     = Math.round(known / total * 100);

  document.getElementById('fc-sum-icon').textContent =
    pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📖';
  document.getElementById('fc-sum-title').textContent =
    pct >= 80 ? 'Чудово! Більшість вже знаєш!' :
    pct >= 50 ? 'Непогано! Продовжуй повторювати.' : 'Вивчай далі, ти справишся!';
  document.getElementById('fc-sum-sub').innerHTML =
    `✅ Знаю: <b>${known}</b> &nbsp; ✗ Ще вчу: <b>${unknown}</b> &nbsp; — Не оцінено: <b>${unseen}</b>`;

  // Save progress
  const p = loadProg();
  p[fc.topicId] = p[fc.topicId] || {};
  p[fc.topicId].seen  = (p[fc.topicId].seen || 0) + total;
  p[fc.topicId].known = known;
  saveProg(p);

  document.getElementById('fc-retry-unknown').disabled = unknown === 0;
  document.getElementById('fc-summary').classList.remove('hidden');

  if (pct >= 80) confetti();
}

// ══════════════════════════════════════════════════
//  QUIZ MODE
// ══════════════════════════════════════════════════
let qz = {};

function startQuiz(topic) {
  qz = {
    topic,
    questions: shuffle([...topic.questions]),
    idx: 0, score: 0, answered: false, answers: [],
  };
  const quizTitle = document.getElementById('quiz-title');
  quizTitle.textContent = `${topic.icon} ${topic.title}`;
  quizTitle.style.color = topic.color;
  document.getElementById('quiz-sub').textContent   = `${topic.questions.length} питань · квіз`;
  show('quiz-screen');
  renderQuestion();
}

function renderQuestion() {
  const q     = qz.questions[qz.idx];
  const total = qz.questions.length;

  document.getElementById('q-progress-fill').style.width = `${(qz.idx / total) * 100}%`;
  document.getElementById('q-count').textContent = `${qz.idx + 1} / ${total}`;

  const badge = document.getElementById('q-topic-badge');
  badge.style.display = 'none';

  document.getElementById('question-text').textContent = q.q;

  const optsEl = document.getElementById('options');
  optsEl.innerHTML = '';
  ['А','Б','В','Г'].forEach((ltr, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${ltr}</span><span class="opt-text">${esc(q.opts[i])}</span>`;
    btn.addEventListener('click', () => selectAnswer(i));
    optsEl.appendChild(btn);
  });

  document.getElementById('explanation').classList.remove('show');
  document.getElementById('next-btn').classList.remove('show');
  document.getElementById('finish-btn').classList.remove('show');
  qz.answered = false;

  document.querySelector('.question-card').classList.remove('fade-up');
  void document.querySelector('.question-card').offsetWidth;
  document.querySelector('.question-card').classList.add('fade-up');
}

function selectAnswer(idx) {
  if (qz.answered) return;
  qz.answered = true;

  const q     = qz.questions[qz.idx];
  const btns  = document.querySelectorAll('.option-btn');
  const ok    = idx === q.correct;
  if (ok) qz.score++;
  qz.answers.push(ok);

  btns[idx].classList.add(ok ? 'correct' : 'wrong');
  if (!ok) btns[q.correct].classList.add('correct');
  btns.forEach(b => b.disabled = true);

  const expEl = document.getElementById('explanation');
  expEl.innerHTML = `<strong>${ok ? '✓ Правильно!' : '✗ Неправильно.'}</strong> ${esc(q.exp)}`;
  expEl.classList.add('show');

  const isLast = qz.idx === qz.questions.length - 1;
  document.getElementById(isLast ? 'finish-btn' : 'next-btn').classList.add('show');
}

function finishQuiz() {
  const p = loadProg();
  p[qz.topic.id] = p[qz.topic.id] || {};
  p[qz.topic.id].best     = Math.max(p[qz.topic.id].best || 0, qz.score);
  p[qz.topic.id].total    = qz.questions.length;
  p[qz.topic.id].attempts = (p[qz.topic.id].attempts || 0) + 1;
  saveProg(p);

  const pct = Math.round(qz.score / qz.questions.length * 100);
  const circle = document.getElementById('result-circle');
  circle.querySelector('.result-score').textContent = `${qz.score}/${qz.questions.length}`;
  circle.className = 'result-circle ' + (pct >= 70 ? '' : pct >= 50 ? 'mid' : 'bad');

  document.getElementById('result-title').textContent =
    pct >= 80 ? '🎉 Відмінно!' : pct >= 60 ? '👍 Добре!' : pct >= 40 ? '💪 Практикуйся!' : '📖 Повтори матеріал';
  document.getElementById('result-sub').textContent =
    `Правильних: ${qz.score} з ${qz.questions.length} (${pct}%)`;
  document.getElementById('result-breakdown').style.display = 'none';

  show('result-screen');
  if (pct >= 80) confetti();
}

// ── SCREEN MANAGER ────────────────────────────────
function show(screenId) {
  ['home-screen','flashcard-screen','quiz-screen','result-screen'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== screenId);
  });
  window.scrollTo(0, 0);
}

// ── CONFETTI ──────────────────────────────────────
function confetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width = innerWidth; canvas.height = innerHeight;
  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'];
  const particles = Array.from({length:120}, () => ({
    x: Math.random()*canvas.width, y: -10,
    r: Math.random()*6+3,
    color: COLORS[Math.floor(Math.random()*COLORS.length)],
    vx: (Math.random()-.5)*4, vy: Math.random()*3+2,
    op: 1,
  }));
  (function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.op-=.007;
      if (p.op>0) alive=true;
      ctx.globalAlpha=Math.max(0,p.op);
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;
    if (alive) requestAnimationFrame(draw);
  })();
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHome();

  // Flashcard events
  document.getElementById('fc-scene').addEventListener('click', flipCard);
  document.getElementById('fc-prev').addEventListener('click', () => {
    if (fc.idx > 0) { fc.idx--; renderCard(); }
  });
  document.getElementById('fc-next').addEventListener('click', () => {
    if (fc.idx < fc.cards.length - 1) { fc.idx++; renderCard(); }
  });
  document.getElementById('fc-known').addEventListener('click',   () => markCard('known'));
  document.getElementById('fc-unknown').addEventListener('click', () => markCard('unknown'));
  document.getElementById('fc-back-btn').addEventListener('click', () => {
    renderHome(); show('home-screen');
  });

  document.getElementById('fc-retry-unknown').addEventListener('click', () => {
    document.getElementById('fc-summary').classList.add('hidden');
    const t = TOPICS.find(x => x.id === fc.topicId);
    startFlashcards(t, true);
  });
  document.getElementById('fc-retry-all').addEventListener('click', () => {
    document.getElementById('fc-summary').classList.add('hidden');
    const t = TOPICS.find(x => x.id === fc.topicId);
    startFlashcards(t, false);
  });
  document.getElementById('fc-home').addEventListener('click', () => {
    document.getElementById('fc-summary').classList.add('hidden');
    renderHome(); show('home-screen');
  });

  document.getElementById('quiz-back-btn').addEventListener('click', () => {
    renderHome(); show('home-screen');
  });

  // Quiz events
  document.getElementById('next-btn').addEventListener('click',   () => { qz.idx++; renderQuestion(); });
  document.getElementById('finish-btn').addEventListener('click', finishQuiz);
  document.getElementById('retry-btn').addEventListener('click',  () => startQuiz(qz.topic));
  document.getElementById('home-btn').addEventListener('click',   () => { renderHome(); show('home-screen'); });
});
