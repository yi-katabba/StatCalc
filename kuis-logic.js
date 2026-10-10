/* =========================================================================
     KUIS STATISTIKA — logika menu Kuis (soal diambil dari kuis.js)
     ========================================================================= */ 
(function () {
  'use strict';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  const introCard = $('#quizIntroCard');
  const introHint = $('#quizIntroHint');
  const startBtn = $('#quizStartBtn');
  const playCard = $('#quizPlayCard');
  const progressFill = $('#quizProgressFill');
  const progressLabel = $('#quizProgressLabel');
  const questionText = $('#quizQuestionText');
  const optionsWrap = $('#quizOptions');
  const explainWrap = $('#quizExplain');
  const prevBtn = $('#quizPrevBtn');
  const nextBtn = $('#quizNextBtn');
  const resultCard = $('#quizResultCard');
  const scoreNum = $('#quizScoreNum');
  const scoreLabel = $('#quizScoreLabel');
  const retryBtn = $('#quizRetryBtn');
  const reviewToggleBtn = $('#quizReviewToggleBtn');
  const reviewWrap = $('#quizReviewWrap');

  if (!introCard) return;

  const QUESTIONS = Array.isArray(window.KUIS_STATISTIK) ? window.KUIS_STATISTIK : [];
  let idx = 0;
  let answers = [];

  function initIntro() {
    if (QUESTIONS.length === 0) {
      introHint.textContent = 'Soal belum tersedia. Pastikan berkas kuis.js sudah dimuat.';
      startBtn.disabled = true;
      startBtn.style.opacity = '.5';
    } else {
      introHint.textContent = `Kuis ini berisi ${QUESTIONS.length} soal pilihan ganda seputar statistika. Jawaban benar ditandai hijau, jawaban salah ditandai merah beserta pembahasannya.`;
      startBtn.disabled = false;
      startBtn.style.opacity = '';
    }
  }

  function resetToIntro() {
    idx = 0;
    answers = new Array(QUESTIONS.length).fill(null);
    introCard.hidden = false;
    playCard.hidden = true;
    resultCard.hidden = true;
    reviewWrap.hidden = true;
    reviewWrap.innerHTML = '';
    reviewToggleBtn.textContent = 'Lihat Pembahasan';
    initIntro();
  }
  resetToIntro();

  startBtn.addEventListener('click', () => {
    if (QUESTIONS.length === 0) return;
    idx = 0;
    answers = new Array(QUESTIONS.length).fill(null);
    introCard.hidden = true;
    resultCard.hidden = true;
    playCard.hidden = false;
    renderQuestion();
  });

  function renderQuestion() {
    const total = QUESTIONS.length;
    const q = QUESTIONS[idx];
    progressFill.style.width = `${((idx + 1) / total) * 100}%`;
    progressLabel.textContent = `${idx + 1} / ${total}`;
    questionText.textContent = q.question;
    const chosen = answers[idx];
    optionsWrap.innerHTML = q.options.map((opt, i) => {
      let cls = 'quiz-opt';
      if (chosen !== null) {
        if (i === q.answer) cls += ' correct';
        else if (i === chosen) cls += ' wrong';
      }
      return `<button type="button" class="${cls}" data-idx="${i}"><span class="qo-letter">${LETTERS[i]}</span><span class="qo-text">${opt}</span></button>`;
    }).join('');
    if (chosen !== null && q.pembahasan) {
      explainWrap.innerHTML = `<strong>Pembahasan:</strong> ${q.pembahasan}`;
      explainWrap.classList.add('show');
    } else {
      explainWrap.classList.remove('show');
      explainWrap.innerHTML = '';
    }
    prevBtn.disabled = idx === 0;
    prevBtn.style.opacity = idx === 0 ? '.5' : '';
    nextBtn.textContent = idx === total - 1 ? 'Selesai' : 'Selanjutnya \u2192';
  }

  optionsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.quiz-opt');
    if (!btn) return;
    if (answers[idx] !== null) return;
    answers[idx] = parseInt(btn.dataset.idx, 10);
    renderQuestion();
  });

  prevBtn.addEventListener('click', () => { if (idx > 0) { idx -= 1; renderQuestion(); } });

  nextBtn.addEventListener('click', () => {
    const total = QUESTIONS.length;
    if (idx < total - 1) { idx += 1; renderQuestion(); }
    else finishQuiz();
  });

  function finishQuiz() {
    const total = QUESTIONS.length;
    let correct = 0;
    QUESTIONS.forEach((q, i) => { if (answers[i] === q.answer) correct += 1; });
    const pct = total ? Math.round((correct / total) * 100) : 0;
    playCard.hidden = true;
    resultCard.hidden = false;
    scoreNum.textContent = `${pct}%`;
    scoreLabel.textContent = `${correct} dari ${total} soal benar`;
    reviewWrap.hidden = true;
    reviewWrap.innerHTML = buildReviewHTML();
    reviewToggleBtn.textContent = 'Lihat Pembahasan';
    if (window.StatCalc && window.StatCalc.trackCalc) window.StatCalc.trackCalc();
  }

  function buildReviewHTML() {
    return QUESTIONS.map((q, i) => {
      const chosen = answers[i];
      const isCorrect = chosen === q.answer;
      const chosenText = chosen === null || chosen === undefined ? 'Tidak dijawab' : q.options[chosen];
      return `<div class="quiz-review-item ${isCorrect ? 'benar' : 'salah'}">
        <span class="qr-tag">${isCorrect ? '\u2713 Benar' : '\u2717 Salah'}</span>
        <div class="qr-q">${i + 1}. ${q.question}</div>
        <div class="qr-ans">Jawaban Anda: ${chosenText}</div>
        ${!isCorrect ? `<div class="qr-ans">Jawaban benar: ${q.options[q.answer]}</div>` : ''}
        ${q.pembahasan ? `<div class="qr-explain">${q.pembahasan}</div>` : ''}
      </div>`;
    }).join('');
  }

  retryBtn.addEventListener('click', resetToIntro);
  reviewToggleBtn.addEventListener('click', () => {
    const willShow = reviewWrap.hidden;
    reviewWrap.hidden = !willShow;
    reviewToggleBtn.textContent = willShow ? 'Sembunyikan Pembahasan' : 'Lihat Pembahasan';
  });

  window.StatCalcQuiz = { resetToIntro };
})();
