// gameStateManager.js - Decision Engine
// Analyzes game state and determines what should happen next

class GameStateManager {
    // Game state decisions
    static STATES = {
        CONTINUE_TURN: 'CONTINUE_TURN',      // Same player continues (after capture with cards left)
        NEXT_PLAYER: 'NEXT_PLAYER',          // Move to next player with cards
        DEAL_NEW_HAND: 'DEAL_NEW_HAND',      // All hands empty, deal new cards
        END_ROUND: 'END_ROUND',              // Deck empty, apply jackpot
        END_GAME: 'END_GAME'                 // Someone reached target score
    };

    // Analyze current game state and return decision
    static determineGameState(gameEngine, targetScore = 500) {
        const state = gameEngine.getState();
        
        console.log('🔍 GameStateManager analyzing state...');
        console.log('Current player:', state.currentPlayer);
        console.log('Last action:', state.lastAction);
        console.log('Total cards in hands:', this.getTotalCardsInHands(state));
        console.log('Cards in deck:', state.deck.length);
        
        // Check for game winner first
        const winner = state.players.find(player => player.score >= targetScore);
        if (winner) {
            console.log('🏆 Game winner detected:', winner.name);
            return {
                action: this.STATES.END_GAME,
                winner: winner,
                data: { winner }
            };
        }
        
        // Check if current player should continue (capture + still has cards)
        if (state.lastAction === 'capture') {
            const currentPlayer = state.players[state.currentPlayer];
            if (currentPlayer.hand.length > 0) {
                console.log('✅ Player continues turn after capture');
                return {
                    action: this.STATES.CONTINUE_TURN,
                    nextPlayer: state.currentPlayer,
                    data: { reason: 'capture_continues' }
                };
            }
        }
        
        // Check if all hands are empty
        const totalCardsInHands = this.getTotalCardsInHands(state);
        if (totalCardsInHands === 0) {
            // All hands empty - either deal new hand or end round
            if (state.deck.length >= 12) {
                console.log('🃏 All hands empty, dealing new hand');
                return {
                    action: this.STATES.DEAL_NEW_HAND,
                    data: { cardsRemaining: state.deck.length }
                };
            } else {
                console.log('🏁 Round over - deck exhausted');
                return {
                    action: this.STATES.END_ROUND,
                    data: { 
                        jackpotAvailable: state.board.length > 0 && state.lastCapturer !== null,
                        lastCapturer: state.lastCapturer,
                        boardCards: state.board.length
                    }
                };
            }
        }
        
        // Find next player with cards
        const nextPlayer = this.findNextPlayerWithCards(state);
        if (nextPlayer === null) {
            console.log('⚠️ No players have cards - unexpected state');
            return {
                action: this.STATES.DEAL_NEW_HAND,
                data: { reason: 'emergency_deal' }
            };
        }
        
        console.log('➡️ Moving to next player:', nextPlayer);
        return {
            action: this.STATES.NEXT_PLAYER,
            nextPlayer: nextPlayer,
            data: { reason: 'normal_turn_advance' }
        };
    }
    
    // Find next player with cards (clockwise rotation)
    static findNextPlayerWithCards(state) {
        const startingPlayer = state.currentPlayer;
        
        // Try each player clockwise from current + 1
        for (let i = 1; i <= 3; i++) {
            const nextPlayerIndex = (startingPlayer + i) % 3;
            const player = state.players[nextPlayerIndex];
            
            if (player && player.hand.length > 0) {
                console.log(`Found next player with cards: ${nextPlayerIndex} (${player.name})`);
                return nextPlayerIndex;
            }
        }
        
        // No player has cards
        console.log('No players have cards');
        return null;
    }
    
    // Get total cards across all player hands
    static getTotalCardsInHands(state) {
        return state.players.reduce((sum, player) => sum + player.hand.length, 0);
    }
    
    // Validate game state for consistency
    static validateGameState(gameEngine) {
        const state = gameEngine.getState();
        const issues = [];
        
        // Check total cards (should be 52)
        const totalCards = this.getTotalCardsInHands(state) + 
                          state.board.length + 
                          state.deck.length + 
                          state.players.reduce((sum, p) => sum + p.captured.length, 0);
        
        if (totalCards !== 52) {
            issues.push(`Card count mismatch: ${totalCards}/52`);
        }
        
        // Check current player validity
        if (state.currentPlayer < 0 || state.currentPlayer > 2) {
            issues.push(`Invalid current player: ${state.currentPlayer}`);
        }
        
        // Check if current player has cards when they should
        const currentPlayer = state.players[state.currentPlayer];
        if (state.gameStarted && currentPlayer && currentPlayer.hand.length === 0) {
            const othersHaveCards = state.players.some((p, i) => i !== state.currentPlayer && p.hand.length > 0);
            if (othersHaveCards) {
                issues.push(`Current player ${state.currentPlayer} has no cards but others do`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }
    
    // Handle specific game state transitions
    static executeDecision(decision, gameEngine) {
        console.log('🎬 Executing decision:', decision.action);
        
        switch (decision.action) {
            case this.STATES.CONTINUE_TURN:
                // Current player keeps turn - no state change needed
                return { success: true, message: 'Player continues turn' };
                
            case this.STATES.NEXT_PLAYER:
                gameEngine.setCurrentPlayer(decision.nextPlayer);
                return { 
                    success: true, 
                    message: `Turn advanced to player ${decision.nextPlayer}`,
                    nextPlayer: decision.nextPlayer
                };
                
            case this.STATES.DEAL_NEW_HAND:
                const dealResult = gameEngine.dealNewHand();
                return {
                    success: dealResult.success,
                    message: dealResult.success ? 
                        `New hand dealt, ${dealResult.cardsRemaining} cards remaining` : 
                        dealResult.error,
                    cardsRemaining: dealResult.cardsRemaining
                };
                
            case this.STATES.END_ROUND:
                const jackpotResult = gameEngine.applyJackpot();
                return {
                    success: true,
                    message: 'Round ended',
                    jackpot: jackpotResult
                };
                
            case this.STATES.END_GAME:
                return {
                    success: true,
                    message: `Game over! ${decision.winner.name} wins!`,
                    winner: decision.winner
                };
                
            default:
                return { success: false, message: `Unknown decision: ${decision.action}` };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameStateManager;
} else {
    window.GameStateManager = GameStateManager;
}