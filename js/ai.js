function makeAIMove(hand, board, difficulty) {
  const possibleCaptures = findPossibleCaptures(hand, board);
  if (possibleCaptures.length > 0) {
    let chosen;
    if (difficulty === 'beginner') {
      chosen = possibleCaptures[Math.floor(Math.random() * possibleCaptures.length)];
    } else {
      chosen = possibleCaptures.reduce((max, p) => p.score > max.score ? p : max, possibleCaptures[0]);
    }
    return { action: 'capture', handCard: chosen.handCard, boardCards: chosen.boardCards };
  } else {
    let placeCard;
    if (difficulty === 'beginner') {
      placeCard = hand[Math.floor(Math.random() * hand.length)];
    } else {
      placeCard = hand.reduce((min, c) => getValue(c) < getValue(min) ? c : min, hand[0]);
    }
    return { action: 'place', handCard: placeCard };
  }
}

function findPossibleCaptures(hand, board) {
  const possible = [];
  hand.forEach(h => {
    // Match captures
    const matching = board.filter(c => c.rank === h.rank);
    if (matching.length > 0) {
      const score = getScore(h) + matching.reduce((s, c) => s + getScore(c), 0);
      possible.push({ handCard: h, boardCards: matching, score });
    }
    // Sum captures (if not face)
    if (!isFace(h)) {
      const target = getValue(h);
      const numberCards = board.filter(c => !isFace(c));
      const sumSubsets = findSubsetsThatSum(numberCards, target);
      sumSubsets.forEach(sub => {
        const score = getScore(h) + sub.reduce((s, c) => s + getScore(c), 0);
        possible.push({ handCard: h, boardCards: sub, score });
      });
    }
  });
  return possible;
}

function findSubsetsThatSum(cards, target) {
  const results = [];
  function recurse(start, current, sum) {
    if (sum === target && current.length > 0) {
      results.push([...current]);
    }
    if (sum >= target) return;
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i]);
      recurse(i + 1, current, sum + getValue(cards[i]));
      current.pop();
    }
  }
  recurse(0, [], 0);
  return results;
}

// Shared helpers (duplicated for self-contained file)
function getValue(card) {
  if (card.rank === 'A') return 1;
  if (card.rank === 'J') return 11;
  if (card.rank === 'Q') return 12;
  if (card.rank === 'K') return 13;
  if (card.rank === '10') return 10;
  return parseInt(card.rank);
}

function isFace(card) {
  return ['J', 'Q', 'K'].includes(card.rank);
}

function getScore(card) {
  if (card.rank === 'A') return 15;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 10;
  return 5;
}