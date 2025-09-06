// main.js - Game Controller
// Coordinates between UI, GameEngine, GameStateManager, and AI

class GameController {
    constructor() {
        this.gameEngine = new GameEngine();
        this.aiPlayers = {
            1: new AIPlayer('intermediate'),
            2: new AIPlayer('intermediate')
        };
        this.isProcessing = false;
        this.callbacks = {
            onStateUpdate: null,
            onMessage: null,
            onGameEnd: null
        };
    }
    
    // Register callbacks for UI updates
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }
    
    // Start a new game
    startGame() {
        console.log('🎮 GameController: Starting new game');
        
        const initialState = this.gameEngine.initGame();
        this.updateUI('Game started! Your turn.');
        
        return initialState;
    }
    
    // Handle player action (capture or place)
    async handlePlayerAction(action) {
        if (this.isProcessing) {
            console.log('⚠️ Action ignored - already processing');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            console.log('👤 Player action:', action.type);
            
            let result;
            if (action.type === 'capture') {
                result = this.gameEngine.executeCapture(action.handCard, action.boardCards);
                if (!result.success) {
                    this.updateUI(result.error);
                    this.isProcessing = false;
                    return;
                }
                this.updateUI(`Captured ${result.capturedCards.length} cards for ${result.score} points!`);
            } else {
                result = this.gameEngine.executePlace(action.handCard);
                this.updateUI(`Placed ${action.handCard.rank}${action.handCard.suit} on the board.`);
            }
            
            // Let UI update, then process game state
            setTimeout(() => {
                this.processGameState();
            }, 500);
            
        } catch (error) {
            console.error('Error handling player action:', error);
            this.updateUI('An error occurred. Please try again.');
            this.isProcessing = false;
        }
    }
    
    // Process current game state and determine next action
    async processGameState() {
        try {
            const decision = GameStateManager.determineGameState(this.gameEngine);
            console.log('🎯 GameController processing decision:', decision.action);
            
            const result = GameStateManager.executeDecision(decision, this.gameEngine);
            
            switch (decision.action) {
                case GameStateManager.STATES.CONTINUE_TURN:
                    this.updateUI('You captured cards and continue your turn!');
                    this.isProcessing = false;
                    break;
                    
                case GameStateManager.STATES.NEXT_PLAYER:
                    await this.handleNextPlayer(decision.nextPlayer);
                    break;
                    
                case GameStateManager.STATES.DEAL_NEW_HAND:
                    this.updateUI(`New hand dealt! ${result.cardsRemaining} cards remaining in deck.`);
                    setTimeout(() => this.processGameState(), 1000);
                    break;
                    
                case GameStateManager.STATES.END_ROUND:
                    this.handleEndRound(result);
                    break;
                    
                case GameStateManager.STATES.END_GAME:
                    this.handleEndGame(result);
                    break;
            }
            
        } catch (error) {
            console.error('Error processing game state:', error);
            this.isProcessing = false;
        }
    }
    
    // Handle moving to next player
    async handleNextPlayer(nextPlayer) {
        if (nextPlayer === 0) {
            // Human player's turn
            this.updateUI('Your turn! Select a card from your hand.');
            this.isProcessing = false;
        } else {
            // AI player's turn
            await this.executeAITurn(nextPlayer);
        }
    }
    
    // Execute AI turn
    async executeAITurn(playerId) {
        const state = this.gameEngine.getState();
        const player = state.players[playerId];
        
        this.updateUI(`${player.name} is thinking...`);
        
        // Add thinking delay for realism
        setTimeout(async () => {
            try {
                const aiMove = this.aiPlayers[playerId].makeMove(this.gameEngine, playerId);
                
                if (!aiMove) {
                    console.log(`⚠️ AI ${playerId} has no valid moves`);
                    this.processGameState();
                    return;
                }
                
                console.log(`🤖 AI ${playerId} executing:`, aiMove.type);
                
                // Execute AI move
                let result;
                if (aiMove.type === 'capture') {
                    result = this.gameEngine.executeCapture(aiMove.handCard, aiMove.boardCards);
                    if (result.success) {
                        this.updateUI(`${player.name} captured ${result.capturedCards.length} cards for ${result.score} points!`);
                    }
                } else {
                    result = this.gameEngine.executePlace(aiMove.handCard);
                    this.updateUI(`${player.name} placed ${aiMove.handCard.rank}${aiMove.handCard.suit} on the board.`);
                }
                
                // Process next game state after AI move
                setTimeout(() => {
                    this.processGameState();
                }, 1500);
                
            } catch (error) {
                console.error(`Error in AI ${playerId} turn:`, error);
                this.processGameState();
            }
        }, 1000); // 1 second thinking time
    }
    
    // Handle round end
    handleEndRound(result) {
        if (result.jackpot && result.jackpot.success) {
            this.updateUI(`${result.jackpot.winner} wins the jackpot! +${result.jackpot.score} points from ${result.jackpot.cards} cards!`);
        } else {
            this.updateUI('Round ended. No jackpot this time.');
        }
        
        // Check for game winner
        const state = this.gameEngine.getState();
        const winner = state.players.find(player => player.score >= 500);
        
        if (winner) {
            this.handleEndGame({ winner });
        } else {
            this.updateUI('Round complete! Start a new game to continue.');
        }
        
        this.isProcessing = false;
    }
    
    // Handle game end
    handleEndGame(result) {
        this.updateUI(`${result.winner.name} wins the game with ${result.winner.score} points!`);
        if (this.callbacks.onGameEnd) {
            this.callbacks.onGameEnd(result.winner);
        }
        this.isProcessing = false;
    }
    
    // Update UI with current state and message
    updateUI(message) {
        const state = this.gameEngine.getState();
        
        if (this.callbacks.onStateUpdate) {
            this.callbacks.onStateUpdate(state);
        }
        
        if (this.callbacks.onMessage && message) {
            this.callbacks.onMessage(message);
        }
    }
    
    // Get current game state (read-only)
    getGameState() {
        return this.gameEngine.getState();
    }
    
    // Validate if player can make a move
    canPlayerMove() {
        const state = this.gameEngine.getState();
        return !this.isProcessing && 
               state.currentPlayer === 0 && 
               state.players[0].hand.length > 0;
    }
    
    // Get available captures for a hand card
    getAvailableCaptures(handCard) {
        return this.gameEngine.findCaptures(handCard);
    }
    
    // Validate a potential capture
    validateCapture(handCard, boardCards) {
        return this.gameEngine.validateCapture(handCard, boardCards);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameController;
} else {
    window.GameController = GameController;
}