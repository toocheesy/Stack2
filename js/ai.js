// ai.js - AI Decision Maker
// Makes strategic decisions for bot players but doesn't execute them

class AIPlayer {
    constructor(difficulty = 'intermediate') {
        this.difficulty = difficulty;
        this.personality = this.getDifficultySettings(difficulty);
    }
    
    getDifficultySettings(difficulty) {
        const settings = {
            beginner: {
                captureThreshold: 10,      // Minimum points to attempt capture
                riskTolerance: 0.3,        // How willing to place valuable cards
                lookAhead: 1,              // How many moves to think ahead
                randomness: 0.3            // Chance to make suboptimal moves
            },
            intermediate: {
                captureThreshold: 15,
                riskTolerance: 0.5,
                lookAhead: 2,
                randomness: 0.1
            },
            legendary: {
                captureThreshold: 20,
                riskTolerance: 0.7,
                lookAhead: 3,
                randomness: 0.05
            }
        };
        
        return settings[difficulty] || settings.intermediate;
    }
    
    // Main decision function - returns the best move for AI
    makeMove(gameEngine, playerId) {
        const state = gameEngine.getState();
        const player = state.players[playerId];
        
        if (!player || player.hand.length === 0) {
            return null;
        }
        
        console.log(`🤖 AI ${playerId} (${this.difficulty}) thinking...`);
        console.log(`Hand: ${player.hand.length} cards`);
        console.log(`Board: ${state.board.length} cards`);
        
        let bestMove = null;
        let bestScore = -1;
        
        // Evaluate all possible captures first
        for (const handCard of player.hand) {
            const captures = gameEngine.findCaptures(handCard);
            
            for (const capture of captures) {
                const moveScore = this.evaluateCapture(handCard, capture, state);
                
                if (moveScore > bestScore) {
                    bestScore = moveScore;
                    bestMove = {
                        type: 'capture',
                        handCard: handCard,
                        boardCards: capture,
                        score: moveScore,
                        reasoning: `Capture worth ${moveScore} points`
                    };
                }
            }
        }
        
        // If no good capture found, evaluate placing cards
        if (!bestMove || bestScore < this.personality.captureThreshold) {
            const placeMove = this.evaluatePlacement(player.hand, state);
            
            if (!bestMove || placeMove.score > bestScore) {
                bestMove = placeMove;
            }
        }
        
        // Add some randomness for beginner/intermediate
        if (Math.random() < this.personality.randomness) {
            bestMove = this.makeRandomMove(player.hand, gameEngine);
        }
        
        console.log(`🎯 AI ${playerId} chose:`, bestMove.type, bestMove.reasoning);
        return bestMove;
    }
    
    // Evaluate the value of a capture
    evaluateCapture(handCard, boardCards, gameState) {
        const capturedCards = [handCard, ...boardCards];
        let score = capturedCards.reduce((sum, card) => sum + card.score, 0);
        
        // Bonus for clearing multiple cards from board
        if (boardCards.length > 1) {
            score += boardCards.length * 2;
        }
        
        // Bonus for capturing high-value cards
        const highValueCards = capturedCards.filter(card => card.score >= 10).length;
        score += highValueCards * 3;
        
        // Strategy: Prefer captures that deny opponents good opportunities
        const opponentValue = this.calculateOpponentOpportunityLoss(boardCards, gameState);
        score += opponentValue;
        
        return score;
    }
    
    // Evaluate placing a card on the board
    evaluatePlacement(hand, gameState) {
        let bestCard = null;
        let bestScore = -Infinity;
        let reasoning = '';
        
        for (const card of hand) {
            let score = 0;
            
            // Prefer placing low-value cards
            score -= card.score;
            
            // Avoid placing cards that create easy captures for opponents
            const riskPenalty = this.calculatePlacementRisk(card, gameState);
            score -= riskPenalty;
            
            // Strategic placement based on board state
            const strategicValue = this.calculateStrategicValue(card, gameState);
            score += strategicValue;
            
            if (score > bestScore) {
                bestScore = score;
                bestCard = card;
                reasoning = `Place ${card.rank}${card.suit} (risk: ${riskPenalty}, strategic: ${strategicValue})`;
            }
        }
        
        return {
            type: 'place',
            handCard: bestCard,
            score: bestScore,
            reasoning: reasoning
        };
    }
    
    // Calculate how much this placement helps opponents
    calculatePlacementRisk(card, gameState) {
        let risk = 0;
        
        // Check if placing this card creates obvious captures
        const futureBoard = [...gameState.board, card];
        
        // Risk increases if card matches existing board cards (rank capture)
        const matchingCards = gameState.board.filter(boardCard => boardCard.rank === card.rank);
        if (matchingCards.length > 0) {
            risk += (matchingCards.length + 1) * card.score * 0.5;
        }
        
        // Risk increases if card completes easy sum captures
        if (card.numValue > 0) {
            const sumOpportunities = this.findSumOpportunities(card, gameState.board);
            risk += sumOpportunities * card.score * 0.3;
        }
        
        return risk * this.personality.riskTolerance;
    }
    
    // Calculate strategic value of placing a card
    calculateStrategicValue(card, gameState) {
        let value = 0;
        
        // Value increases if it sets up future captures for us
        // (This is simplified - could be much more sophisticated)
        
        // Prefer placing cards that don't help opponents much
        if (card.score <= 5 && card.numValue === 0) {
            value += 5; // Safe face cards
        }
        
        // Consider board state density
        if (gameState.board.length > 6) {
            value += 3; // Board is getting crowded, place anything
        }
        
        return value;
    }
    
    // Find sum capture opportunities
    findSumOpportunities(card, board) {
        let opportunities = 0;
        
        // Check all combinations of board cards that sum to this card's value
        for (let i = 1; i < (1 << board.length); i++) {
            const combination = [];
            for (let j = 0; j < board.length; j++) {
                if (i & (1 << j) && board[j].numValue > 0) {
                    combination.push(board[j]);
                }
            }
            
            if (combination.length > 0) {
                const sum = combination.reduce((total, c) => total + c.numValue, 0);
                if (sum === card.numValue) {
                    opportunities++;
                }
            }
        }
        
        return opportunities;
    }
    
    // Calculate how much opponent opportunities are reduced by this capture
    calculateOpponentOpportunityLoss(boardCards, gameState) {
        // Simplified: assume removing valuable cards from board helps us
        return boardCards.reduce((sum, card) => sum + card.score * 0.1, 0);
    }
    
    // Make a random move (for variety/mistakes)
    makeRandomMove(hand, gameEngine) {
        const randomCard = hand[Math.floor(Math.random() * hand.length)];
        const captures = gameEngine.findCaptures(randomCard);
        
        if (captures.length > 0 && Math.random() > 0.5) {
            const randomCapture = captures[Math.floor(Math.random() * captures.length)];
            return {
                type: 'capture',
                handCard: randomCard,
                boardCards: randomCapture,
                score: 0,
                reasoning: 'Random capture'
            };
        }
        
        return {
            type: 'place',
            handCard: randomCard,
            score: 0,
            reasoning: 'Random placement'
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIPlayer;
} else {
    window.AIPlayer = AIPlayer;
}