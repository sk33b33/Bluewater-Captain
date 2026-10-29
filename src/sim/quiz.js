// Written test logic: random draw with shuffled options, scoring. RNG is injectable for tests.
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickQuestions(pool, n, rng = Math.random) {
  return shuffle(pool, rng).slice(0, n).map((q) => {
    const order = shuffle(q.options.map((_, i) => i), rng);
    return { id: q.id, text: q.text, explain: q.explain, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
  });
}

// answers: array of chosen option indexes (or null/undefined for unanswered).
export function scoreQuiz(questions, answers, passMark) {
  const wrong = [];
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.answer) correct += 1;
    else wrong.push(i);
  });
  return { correct, total: questions.length, wrong, passed: correct >= passMark };
}
