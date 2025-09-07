class GameEngine {
  constructor() {
    this.state = {
      deck: [],
      hands: [[], [], []], // 0: human, 1: bot1, 2: bot2
      board: [],
      scores: [0, 0, 0],
      currentPlayer: 0,
      currentDealer: 0,
      lastCapturer: null,
      gameOver: false
    };
  }

  initGame() {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suits = ['♠', '♥', '♦', '♣'];
    this.state.deck = [];
    for (let rank of ranks) {
      for (let suit of suits) {
        this.state.deck.push({ rank, suit });
      }
    }
    this.shuffle(this.state.deck);
    this.dealInitial();
    this.state.currentPlayer = this.state.currentDealer;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  dealInitial() {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        this.state.hands[i].push(this.state.deck.pop());
      }
    }
    for (let j = 0; j < 4; j++) {
      this.state.board.push(this.state.deck.pop());
    }
  }

  validateCapture(handCard, boardCards) {
    if (boardCards.length === 0) return false;
    const handVal = this.getValue(handCard);
    const isHandFace = this.isFace(handCard);
    const allSameRank = boardCards.every(c => c.rank === handCard.rank);
    if (allSameRank) return true;
    if (isHandFace) return false;
    const allBoardNumber = boardCards.every(c => !this.isFace(c));
    if (!allBoardNumber) return false;
    const boardSum = boardCards.reduce((s, c) => s + this.getValue(c), 0);
    return boardSum === handVal;
  }

  executeCapture(handCard, boardCards) {
    if (!this.validateCapture(handCard, boardCards)) return false;
    const handIdx = this.state.hands[this.state.currentPlayer].findIndex(c => c === handCard);
    this.state.hands[this.state.currentPlayer].splice(handIdx, 1);
    let captureScore = this.getScore(handCard);
    for (let bc of boardCards) {
      const boardIdx = this.state.board.findIndex(c => c === bc);
      this.state.board.splice(boardIdx, 1);
      captureScore += this.getScore(bc);
    }
    this.state.scores[this.state.currentPlayer] += captureScore;
    return true;
  }

  executePlace(handCard) {
    const handIdx = this.state.hands[this.state.currentPlayer].findIndex(c => c === handCard);
    if (handIdx === -1) return false;
    this.state.hands[this.state.currentPlayer].splice(handIdx, 1);
    this.state.board.push(handCard);
    return true;
  }

  afterAction(action) {
    if (action === 'capture') this.state.lastCapturer = this.state.currentPlayer;
    if (action === 'place' || this.state.hands[this.state.currentPlayer].length === 0) {
      this.state.currentPlayer = this.findNextPlayerWithCards();
    }
    if (this.allHandsEmpty()) {
      this.handleEmptyHands();
    }
    if (this.state.scores.some(s => s >= 500)) this.state.gameOver = true;
  }

  findNextPlayerWithCards() {
    for (let i = 1; i <= 3; i++) {
      const p = (this.state.currentPlayer + i) % 3;
      if (this.state.hands[p].length > 0) return p;
    }
    return -1;
  }

  allHandsEmpty() {
    return this.state.hands.every(h => h.length === 0);
  }

  handleEmptyHands() {
    if (this.state.deck.length >= 12) {
      this.dealNewHands();
    } else {
      this.endRound();
    }
  }

  dealNewHands() {
    for (let i = 0; i < 3; i++) {
      const p = (this.state.currentDealer + i) % 3;
      for (let j = 0; j < 4 && this.state.deck.length > 0; j++) {
        this.state.hands[p].push(this.state.deck.pop());
      }
    }
    this.state.currentDealer = (this.state.currentDealer + 1) % 3;
    this.state.currentPlayer = this.state.currentDealer;
  }

  endRound() {
    if (this.state.lastCapturer !== null && this.state.board.length > 0) {
      let jackpotScore = this.state.board.reduce((s, c) => s + this.getScore(c), 0);
      this.state.scores[this.state.lastCapturer] += jackpotScore;
      this.state.board = [];
    }
    this.state.lastCapturer = null;
  }

  getValue(card) {
    if (card.rank === 'A') return 1;
    if (card.rank === 'J') return 11;
    if (card.rank === 'Q') return 12;
    if (card.rank === 'K') return 13;
    if (card.rank === '10') return 10;
    return parseInt(card.rank);
  }

  isFace(card) {
    return ['J', 'Q', 'K'].includes(card.rank);
  }

  getScore(card) {
    if (card.rank === 'A') return 15;
    if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 10;
    return 5;
  }
}