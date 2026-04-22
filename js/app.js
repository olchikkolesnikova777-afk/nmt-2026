// ── State ──────────────────────────────────────────────────
let state = {
  mode: null,       // 'topic' | 'nmt'
  topicId: null,
  questions: [],
  current: 0,
  score: 0,
  answered: false,
  answers: [],      // { correct: bool, topicLabel: str }
};

// ── Storage ────────────────────────────────────────────────
const STORAGE_KEY = 'nmt2026_progress';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function saveTopicResult(topicId, score, total) {
  const p = loadProgress();
  if (!p[topicId]) p[topicId] = { best: 0, attempts: 0 };
  p[topicId].best = Math.max(p[topicId].best, score);
  p[topicId].total = total;
  p[topicId].attempts++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  updateStats();
  renderTopics();
}

function saveNmtResult(score) {
  const p = loadProgress();
  p._nmt = p._nmt || { best: 0, attempts: 0 };
  p._nmt.best = Math.max(p._nmt.best, score);
  p._nmt.attempts++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  updateStats();
}

// ── Stats ──────────────────────────────────────────────────
function updateStats() {
  const p = loadProgress();
  let totalQ = 0, bestSum = 0, topicsDone = 0;
  for (const t of TOPICS) {
    if (p[t.id]) {
      bestSum += p[t.id].best;
      totalQ += p[t.id].total || t.questions.length;
      topicsDone++;
    }
  }
  const nmtBest = p._nmt ? p._nmt.best : null;

  document.getElementById('stat-topics').textContent = `${topicsDone}/${TOPICS.length}`;
  document.getElementById('stat-score').textContent = totalQ ? `${Math.round(bestSum/totalQ*100)}%` : '—';
  document.getElementById('stat-nmt').textContent = nmtBest !== null ? `${nmtBest}/45` : '—';
}

// ── Render Home ────────────────────────────────────────────
function renderTopics() {
  const p = loadProgress();
  const grid = document.getElementById('topic-grid');
  grid.innerHTML = '';

  for (const t of TOPICS) {
    const prog = p[t.id];
    const pct = prog ? Math.round(prog.best / (prog.total || t.questions.length) * 100) : 0;
    const scoreLabel = prog ? `${prog.best}/${prog.total || t.questions.length}` : '—';

    const card = document.createElement('div');
    card.className = 'topic-card';
    card.style.setProperty('--c', t.color);
    card.innerHTML = `
      <div class="topic-icon">${t.icon}</div>
      <div class="topic-title">${t.title}</div>
      <div class="topic-desc">${t.description}</div>
      <div class="topic-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span class="topic-score">${scoreLabel}</span>
      </div>
    `;
    card.addEventListener('click', () => startTopic(t.id));
    grid.appendChild(card);
  }
}

// ── Start Quiz ─────────────────────────────────────────────
function startTopic(topicId) {
  const t = TOPICS.find(x => x.id === topicId);
  state = {
    mode: 'topic', topicId,
    questions: shuffle([...t.questions]),
    current: 0, score: 0, answered: false, answers: []
  };
  document.getElementById('quiz-title').textContent = `${t.icon} ${t.title}`;
  document.getElementById('quiz-sub').textContent = `${t.questions.length} питань · тренування`;
  showScreen('quiz');
  renderQuestion();
}

function startNmt() {
  state = {
    mode: 'nmt', topicId: null,
    questions: shuffle([...NMT_TEST]),
    current: 0, score: 0, answered: false, answers: []
  };
  document.getElementById('quiz-title').textContent = '📋 Повний тест НМТ';
  document.getElementById('quiz-sub').textContent = '30 питань · 60 хвилин';
  showScreen('quiz');
  renderQuestion();
}

// ── Render Question ────────────────────────────────────────
function renderQuestion() {
  const q = state.questions[state.current];
  const total = state.questions.length;

  // Progress
  document.getElementById('q-progress-fill').style.width = `${(state.current / total) * 100}%`;
  document.getElementById('q-count').textContent = `${state.current + 1} / ${total}`;

  // Topic badge
  const badge = document.getElementById('q-topic-badge');
  if (q.topic) { badge.textContent = q.topic; badge.style.display = 'inline-block'; }
  else { badge.style.display = 'none'; }

  document.getElementById('question-text').textContent = q.q;

  const optsEl = document.getElementById('options');
  optsEl.innerHTML = '';
  const letters = ['А', 'Б', 'В', 'Г', 'Д'];
  q.opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span><span>${opt}</span>`;
    btn.addEventListener('click', () => selectAnswer(i));
    optsEl.appendChild(btn);
  });

  document.getElementById('explanation').classList.remove('show');
  document.getElementById('explanation').textContent = '';
  document.getElementById('next-btn').classList.remove('show');
  document.getElementById('finish-btn').classList.remove('show');
  state.answered = false;
}

function selectAnswer(idx) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.current];
  const btns = document.querySelectorAll('.option-btn');
  const isCorrect = idx === q.correct;

  btns[idx].classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) btns[q.correct].classList.add('correct');
  btns.forEach(b => b.disabled = true);

  if (isCorrect) state.score++;
  state.answers.push({ correct: isCorrect, topicLabel: q.topic || '' });

  const expEl = document.getElementById('explanation');
  expEl.innerHTML = `<strong>${isCorrect ? '✓ Правильно!' : '✗ Неправильно.'}</strong> ${q.exp}`;
  expEl.classList.add('show');

  const isLast = state.current === state.questions.length - 1;
  if (isLast) {
    document.getElementById('finish-btn').classList.add('show');
  } else {
    document.getElementById('next-btn').classList.add('show');
  }
}

function nextQuestion() {
  state.current++;
  renderQuestion();
}

function finishQuiz() {
  if (state.mode === 'topic') {
    saveTopicResult(state.topicId, state.score, state.questions.length);
  } else {
    // NMT: score is out of 45 (each correct = 1 pt, 30 questions but NMT gives up to 45)
    // Approximate: 30 questions → max 45 pts (each = 1.5 pt)
    const nmtScore = Math.round(state.score * 1.5);
    saveNmtResult(nmtScore);
    state.nmtScore = nmtScore;
  }
  showResult();
}

// ── Show Result ────────────────────────────────────────────
function showResult() {
  showScreen('result');

  const total = state.questions.length;
  const pct = Math.round(state.score / total * 100);

  const circle = document.getElementById('result-circle');
  circle.querySelector('.result-score').textContent = `${state.score}/${total}`;
  circle.className = 'result-circle ' + (pct >= 70 ? '' : pct >= 50 ? 'mid' : 'bad');

  document.getElementById('result-title').textContent =
    pct >= 80 ? '🎉 Відмінний результат!' :
    pct >= 60 ? '👍 Гарна робота!' :
    pct >= 40 ? '💪 Ще трошки попрактикуйся!' : '📖 Варто повторити матеріал';

  document.getElementById('result-sub').textContent =
    state.mode === 'nmt'
      ? `Приблизний бал НМТ: ${state.nmtScore}/45`
      : `Правильних відповідей: ${state.score} з ${total} (${pct}%)`;

  // Breakdown for NMT mode
  const breakdownEl = document.getElementById('result-breakdown');
  if (state.mode === 'nmt') {
    const topicMap = {};
    state.answers.forEach((a, i) => {
      const tl = state.questions[i].topic || 'Інше';
      if (!topicMap[tl]) topicMap[tl] = { correct: 0, total: 0 };
      topicMap[tl].total++;
      if (a.correct) topicMap[tl].correct++;
    });
    breakdownEl.innerHTML = '<div class="section-title" style="margin-bottom:12px">По темах</div>';
    for (const [topic, v] of Object.entries(topicMap)) {
      const tpct = Math.round(v.correct / v.total * 100);
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `<span class="breakdown-topic">${topic}</span><span class="breakdown-score ${tpct >= 60 ? 'good' : 'bad'}">${v.correct}/${v.total}</span>`;
      breakdownEl.appendChild(row);
    }
    breakdownEl.style.display = 'block';
  } else {
    breakdownEl.style.display = 'none';
  }

  if (pct >= 80) confetti();
}

// ── Screen Manager ─────────────────────────────────────────
function showScreen(name) {
  document.getElementById('home-screen').classList.toggle('hidden', name !== 'home');
  document.getElementById('quiz-screen').classList.toggle('active', name === 'quiz');
  document.getElementById('result-screen').classList.toggle('active', name === 'result');
  if (name !== 'quiz') {
    document.getElementById('quiz-screen').classList.remove('active');
  }
}

// ── Confetti ───────────────────────────────────────────────
function confetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({length: 120}, () => ({
    x: Math.random() * canvas.width, y: -10,
    r: Math.random() * 6 + 3,
    color: ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'][Math.floor(Math.random()*6)],
    vx: (Math.random()-0.5)*4, vy: Math.random()*3+2,
    opacity: 1,
  }));
  let frame;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.opacity -= 0.008;
      if (p.opacity > 0) { alive = true; }
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  draw();
}

// ── Utils ──────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  renderTopics();

  document.getElementById('nmt-btn').addEventListener('click', startNmt);
  document.getElementById('back-btn').addEventListener('click', () => showScreen('home'));
  document.getElementById('next-btn').addEventListener('click', nextQuestion);
  document.getElementById('finish-btn').addEventListener('click', finishQuiz);
  document.getElementById('retry-btn').addEventListener('click', () => {
    if (state.mode === 'topic') startTopic(state.topicId);
    else startNmt();
  });
  document.getElementById('home-btn').addEventListener('click', () => showScreen('home'));
});
