// game.js - Pure Data Engine
// Stores game state and validates rules, but makes NO flow decisions

class GameEngine {
    constructor() {
        this.state = {
            players: [],
            board: [],
            deck: [],
            currentPlayer: 0,
            lastCapturer: null,
            lastAction: null, // 'capture' or 'place'
            gameStarted: false,
            round: 1
        };
    }

    // Initialize new game
    initGame() {
        const deck = this.createDeck();
        
        // Deal initial hands (4 cards each) and board (4 cards)
        this.state.players = Array.from({ length: 3 }, (_, i) => ({
            id: i,
            name: i === 0 ? 'You' : `AI ${i}`,
            hand: deck.slice(i * 4, (i + 1) * 4),
            captured: [],
            score: 0
        }));
        
        this.state.board = deck.slice(12, 16);
        this.state.deck = deck.slice(16); // 36 cards remaining
        this.state.currentPlayer = 0;
        this.state.lastCapturer = null;
        this.state.lastAction = null;
        this.state.gameStarted = true;
        
        return this.getState();
    }

    // Create and shuffle deck
    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        const deck = suits.flatMap(suit => 
            ranks.map(rank => ({ 
                id: `${rank}${suit}`, 
                rank, 
                suit, 
                score: this.getCardScore(rank),
                numValue: rank === 'A' ? 1 : isNaN(parseInt(rank)) ? 0 : parseInt(rank)
            }))
        );
        
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        return deck;
    }

    getCardScore(rank) {
        if (rank === 'A') return 15;
        if (['K', 'Q', 'J', '10'].includes(rank)) return 10;
        return 5;
    }

    // Validate if a capture is legal
    validateCapture(handCard, boardCards) {
        if (!handCard || boardCards.length === 0) return false;
        
        // Rank matching capture
        if (boardCards.every(card => card.rank === handCard.rank)) return true;
        
        // Number sum capture (only for numbered cards)
        if (handCard.numValue > 0) {
            const boardSum = boardCards.reduce((sum, card) => sum + (card.numValue || 0), 0);
            return boardSum === handCard.numValue && boardCards.every(card => card.numValue > 0);
        }
        
        return false;
    }

    // Execute a capture (moves cards, updates score)
    executeCapture(handCard, boardCards) {
        if (!this.validateCapture(handCard, boardCards)) {
            return { success: false, error: 'Invalid capture' };
        }

        const player = this.state.players[this.state.currentPlayer];
        
        // Remove hand card
        player.hand = player.hand.filter(c => c.id !== handCard.id);
        
        // Capture cards
        const capturedCards = [handCard, ...boardCards];
        player.captured.push(...capturedCards);
        player.score += capturedCards.reduce((sum, card) => sum + card.score, 0);
        
        // Remove captured cards from board
        this.state.board = this.state.board.filter(card => 
            !boardCards.some(captured => captured.id === card.id)
        );
        
        this.state.lastCapturer = this.state.currentPlayer;
        this.state.lastAction = 'capture';
        
        return { 
            success: true, 
            capturedCards,
            score: capturedCards.reduce((sum, card) => sum + card.score, 0),
            playerHasCards: player.hand.length > 0
        };
    }

    // Execute placing a card on the board
    executePlace(handCard) {
        const player = this.state.players[this.state.currentPlayer];
        
        // Remove hand card
        player.hand = player.hand.filter(c => c.id !== handCard.id);
        
        // Add to board
        this.state.board.push(handCard);
        
        this.state.lastAction = 'place';
        
        return { success: true };
    }

    // Deal new hands from remaining deck
    dealNewHand() {
        if (this.state.deck.length < 12) {
            return { success: false, error: 'Not enough cards in deck' };
        }
        
        let deckIndex = 0;
        
        // Deal 4 cards to each player
        for (let i = 0; i < 3; i++) {
            this.state.players[i].hand = this.state.deck.slice(deckIndex, deckIndex + 4);
            deckIndex += 4;
        }
        
        this.state.deck = this.state.deck.slice(12);
        
        return { success: true, cardsRemaining: this.state.deck.length };
    }

    // Apply jackpot (last capturer gets remaining board cards)
    applyJackpot() {
        if (this.state.board.length === 0 || this.state.lastCapturer === null) {
            return { success: false, message: 'No jackpot available' };
        }
        
        const player = this.state.players[this.state.lastCapturer];
        const jackpotScore = this.state.board.reduce((sum, card) => sum + card.score, 0);
        
        player.captured.push(...this.state.board);
        player.score += jackpotScore;
        
        const result = {
            success: true,
            winner: player.name,
            cards: this.state.board.length,
            score: jackpotScore
        };
        
        this.state.board = [];
        
        return result;
    }

    // Set current player
    setCurrentPlayer(playerId) {
        this.state.currentPlayer = playerId;
    }

    // Get read-only state snapshot
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    // Find all possible captures for a hand card
    findCaptures(handCard, boardCards = null) {
        const board = boardCards || this.state.board;
        const captures = [];
        
        for (let i = 1; i < (1 << board.length); i++) {
            const combination = [];
            for (let j = 0; j < board.length; j++) {
                if (i & (1 << j)) {
                    combination.push(board[j]);
                }
            }
            
            if (this.validateCapture(handCard, combination)) {
                captures.push(combination);
            }
        }
        
        return captures;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameEngine;
} else {
    window.GameEngine = GameEngine;
}