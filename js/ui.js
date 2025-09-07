class UIManager {
  constructor(game) {
    this.game = game;
    this.selectedHandCard = null;
    this.selectedBoardCards = [];
    this.messageEl = document.getElementById('message');
    this.scoresEl = document.getElementById('scores');
    this.boardEl = document.getElementById('board');
    this.handEl = document.getElementById('hand');
    document.getElementById('captureBtn').onclick = () => this.handleActionButton('capture');
    document.getElementById('placeBtn').onclick = () => this.handleActionButton('place');
  }

  render() {
    this.messageEl.textContent = this.game.state.gameOver ? 'Game Over!' : this.game.state.currentPlayer === 0 ? 'Your turn' : `Bot ${this.game.state.currentPlayer} turn`;
    this.scoresEl.textContent = `You: ${this.game.state.scores[0]} | Bot1: ${this.game.state.scores[1]} | Bot2: ${this.game.state.scores[2]}`;
    this.boardEl.innerHTML = '';
    this.game.state.board.forEach(c => {
      const div = this.createCardDiv(c, () => this.handleBoardCardClick(c));
      if (this.selectedBoardCards.includes(c)) div.classList.add('selected');
      this.boardEl.appendChild(div);
    });
    this.handEl.innerHTML = '';
    if (this.game.state.currentPlayer === 0) {
      this.game.state.hands[0].forEach(c => {
        const div = this.createCardDiv(c, () => this.handleHandCardClick(c));
        if (this.selectedHandCard === c) div.classList.add('selected');
        this.handEl.appendChild(div);
      });
    }
    const hasHandSelect = !!this.selectedHandCard && this.selectedBoardCards.length === 0;
    const hasCaptureSelect = !!this.selectedHandCard && this.selectedBoardCards.length > 0;
    document.getElementById('placeBtn').disabled = !hasHandSelect || this.game.state.gameOver || this.game.state.currentPlayer !== 0;
    document.getElementById('captureBtn').disabled = !hasCaptureSelect || this.game.state.gameOver || this.game.state.currentPlayer !== 0;
    if (!this.game.state.gameOver && this.game.state.currentPlayer !== 0) {
      setTimeout(() => this.playBotTurn(), 1000);
    }
  }

  createCardDiv(card, clickHandler) {
    const div = document.createElement('div');
    div.classList.add('card');
    div.textContent = `${card.rank}${card.suit}`;
    div.onclick = clickHandler;
    return div;
  }

  handleHandCardClick(card) {
    if (this.game.state.currentPlayer !== 0 || this.game.state.gameOver) return;
    this.selectedHandCard = this.selectedHandCard === card ? null : card;
    this.selectedBoardCards = [];
    this.render();
  }

  handleBoardCardClick(card) {
    if (this.game.state.currentPlayer !== 0 || this.game.state.gameOver || !this.selectedHandCard) return;
    const idx = this.selectedBoardCards.indexOf(card);
    if (idx > -1) this.selectedBoardCards.splice(idx, 1);
    else this.selectedBoardCards.push(card);
    this.render();
  }

  handleActionButton(action) {
    if (this.game.state.currentPlayer !== 0 || this.game.state.gameOver) return;
    let success;
    if (action === 'capture') {
      success = this.game.executeCapture(this.selectedHandCard, this.selectedBoardCards);
      if (!success) alert('Invalid capture');
    } else {
      success = this.game.executePlace(this.selectedHandCard);
    }
    if (success) {
      this.game.afterAction(action);
      this.selectedHandCard = null;
      this.selectedBoardCards = [];
      this.render();
    }
  }

  playBotTurn() {
    if (this.game.state.gameOver || this.game.state.currentPlayer === 0) return;
    const diff = this.game.state.currentPlayer === 1 ? 'beginner' : 'intermediate';
    const move = makeAIMove(this.game.state.hands[this.game.state.currentPlayer], this.game.state.board, diff);
    if (move.action === 'capture') {
      this.game.executeCapture(move.handCard, move.boardCards);
    } else {
      this.game.executePlace(move.handCard);
    }
    this.game.afterAction(move.action);
    this.render();
  }
}