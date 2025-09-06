<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>STACKED! Card Game</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    
    <!-- Game Engine Modules -->
    <script>
        // game.js - Pure Data Engine
        class GameEngine {
            constructor() {
                this.state = {
                    players: [],
                    board: [],
                    deck: [],
                    currentPlayer: 0,
                    lastCapturer: null,
                    lastAction: null,
                    gameStarted: false,
                    round: 1
                };
            }

            initGame() {
                const deck = this.createDeck();
                
                this.state.players = Array.from({ length: 3 }, (_, i) => ({
                    id: i,
                    name: i === 0 ? 'You' : `AI ${i}`,
                    hand: deck.slice(i * 4, (i + 1) * 4),
                    captured: [],
                    score: 0
                }));
                
                this.state.board = deck.slice(12, 16);
                this.state.deck = deck.slice(16);
                this.state.currentPlayer = 0;
                this.state.lastCapturer = null;
                this.state.lastAction = null;
                this.state.gameStarted = true;
                
                return this.getState();
            }

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

            validateCapture(handCard, boardCards) {
                if (!handCard || boardCards.length === 0) return false;
                
                if (boardCards.every(card => card.rank === handCard.rank)) return true;
                
                if (handCard.numValue > 0) {
                    const boardSum = boardCards.reduce((sum, card) => sum + (card.numValue || 0), 0);
                    return boardSum === handCard.numValue && boardCards.every(card => card.numValue > 0);
                }
                
                return false;
            }

            executeCapture(handCard, boardCards) {
                if (!this.validateCapture(handCard, boardCards)) {
                    return { success: false, error: 'Invalid capture' };
                }

                const player = this.state.players[this.state.currentPlayer];
                
                player.hand = player.hand.filter(c => c.id !== handCard.id);
                
                const capturedCards = [handCard, ...boardCards];
                player.captured.push(...capturedCards);
                player.score += capturedCards.reduce((sum, card) => sum + card.score, 0);
                
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

            executePlace(handCard) {
                const player = this.state.players[this.state.currentPlayer];
                
                player.hand = player.hand.filter(c => c.id !== handCard.id);
                this.state.board.push(handCard);
                this.state.lastAction = 'place';
                
                return { success: true };
            }

            dealNewHand() {
                if (this.state.deck.length < 12) {
                    return { success: false, error: 'Not enough cards in deck' };
                }
                
                let deckIndex = 0;
                
                for (let i = 0; i < 3; i++) {
                    this.state.players[i].hand = this.state.deck.slice(deckIndex, deckIndex + 4);
                    deckIndex += 4;
                }
                
                this.state.deck = this.state.deck.slice(12);
                
                return { success: true, cardsRemaining: this.state.deck.length };
            }

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

            setCurrentPlayer(playerId) {
                this.state.currentPlayer = playerId;
            }

            getState() {
                return JSON.parse(JSON.stringify(this.state));
            }

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

        // gameStateManager.js - Decision Engine
        class GameStateManager {
            static STATES = {
                CONTINUE_TURN: 'CONTINUE_TURN',
                NEXT_PLAYER: 'NEXT_PLAYER',
                DEAL_NEW_HAND: 'DEAL_NEW_HAND',
                END_ROUND: 'END_ROUND',
                END_GAME: 'END_GAME'
            };

            static determineGameState(gameEngine, targetScore = 500) {
                const state = gameEngine.getState();
                
                console.log('🔍 GameStateManager analyzing state...');
                
                const winner = state.players.find(player => player.score >= targetScore);
                if (winner) {
                    console.log('🏆 Game winner detected:', winner.name);
                    return {
                        action: this.STATES.END_GAME,
                        winner: winner,
                        data: { winner }
                    };
                }
                
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
                
                const totalCardsInHands = this.getTotalCardsInHands(state);
                if (totalCardsInHands === 0) {
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
            
            static findNextPlayerWithCards(state) {
                const startingPlayer = state.currentPlayer;
                
                for (let i = 1; i <= 3; i++) {
                    const nextPlayerIndex = (startingPlayer + i) % 3;
                    const player = state.players[nextPlayerIndex];
                    
                    if (player && player.hand.length > 0) {
                        console.log(`Found next player with cards: ${nextPlayerIndex} (${player.name})`);
                        return nextPlayerIndex;
                    }
                }
                
                console.log('No players have cards');
                return null;
            }
            
            static getTotalCardsInHands(state) {
                return state.players.reduce((sum, player) => sum + player.hand.length, 0);
            }
            
            static executeDecision(decision, gameEngine) {
                console.log('🎬 Executing decision:', decision.action);
                
                switch (decision.action) {
                    case this.STATES.CONTINUE_TURN:
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

        // ai.js - AI Decision Maker
        class AIPlayer {
            constructor(difficulty = 'intermediate') {
                this.difficulty = difficulty;
                this.personality = this.getDifficultySettings(difficulty);
            }
            
            getDifficultySettings(difficulty) {
                const settings = {
                    beginner: {
                        captureThreshold: 10,
                        riskTolerance: 0.3,
                        lookAhead: 1,
                        randomness: 0.3
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
            
            makeMove(gameEngine, playerId) {
                const state = gameEngine.getState();
                const player = state.players[playerId];
                
                if (!player || player.hand.length === 0) {
                    return null;
                }
                
                console.log(`🤖 AI ${playerId} (${this.difficulty}) thinking...`);
                
                let bestMove = null;
                let bestScore = -1;
                
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
                
                if (!bestMove || bestScore < this.personality.captureThreshold) {
                    const placeMove = this.evaluatePlacement(player.hand, state);
                    
                    if (!bestMove || placeMove.score > bestScore) {
                        bestMove = placeMove;
                    }
                }
                
                if (Math.random() < this.personality.randomness) {
                    bestMove = this.makeRandomMove(player.hand, gameEngine);
                }
                
                console.log(`🎯 AI ${playerId} chose:`, bestMove.type, bestMove.reasoning);
                return bestMove;
            }
            
            evaluateCapture(handCard, boardCards, gameState) {
                const capturedCards = [handCard, ...boardCards];
                let score = capturedCards.reduce((sum, card) => sum + card.score, 0);
                
                if (boardCards.length > 1) {
                    score += boardCards.length * 2;
                }
                
                const highValueCards = capturedCards.filter(card => card.score >= 10).length;
                score += highValueCards * 3;
                
                return score;
            }
            
            evaluatePlacement(hand, gameState) {
                let bestCard = null;
                let bestScore = -Infinity;
                let reasoning = '';
                
                for (const card of hand) {
                    let score = 0;
                    
                    score -= card.score;
                    
                    const riskPenalty = this.calculatePlacementRisk(card, gameState);
                    score -= riskPenalty;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestCard = card;
                        reasoning = `Place ${card.rank}${card.suit} (low risk)`;
                    }
                }
                
                return {
                    type: 'place',
                    handCard: bestCard,
                    score: bestScore,
                    reasoning: reasoning
                };
            }
            
            calculatePlacementRisk(card, gameState) {
                let risk = 0;
                
                const matchingCards = gameState.board.filter(boardCard => boardCard.rank === card.rank);
                if (matchingCards.length > 0) {
                    risk += (matchingCards.length + 1) * card.score * 0.5;
                }
                
                return risk * this.personality.riskTolerance;
            }
            
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

        // main.js - Game Controller
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
            
            setCallbacks(callbacks) {
                this.callbacks = { ...this.callbacks, ...callbacks };
            }
            
            startGame() {
                console.log('🎮 GameController: Starting new game');
                
                const initialState = this.gameEngine.initGame();
                this.updateUI('Game started! Your turn.');
                
                return initialState;
            }
            
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
                    
                    setTimeout(() => {
                        this.processGameState();
                    }, 500);
                    
                } catch (error) {
                    console.error('Error handling player action:', error);
                    this.updateUI('An error occurred. Please try again.');
                    this.isProcessing = false;
                }
            }
            
            async processGameState() {
                console.log('🔍 processGameState called');
                console.log('isProcessing:', this.isProcessing);
                
                try {
                    const currentState = this.gameEngine.getState();
                    console.log('📊 Current game state:');
                    console.log('  currentPlayer:', currentState.currentPlayer);
                    console.log('  lastAction:', currentState.lastAction);
                    console.log('  Player hands:', currentState.players.map(p => `${p.name}: ${p.hand.length} cards`));
                    
                    const decision = GameStateManager.determineGameState(this.gameEngine);
                    console.log('🎯 GameStateManager decision:', decision.action);
                    console.log('🎯 Decision data:', decision);
                    
                    const result = GameStateManager.executeDecision(decision, this.gameEngine);
                    console.log('🎬 Decision execution result:', result);
                    
                    switch (decision.action) {
                        case GameStateManager.STATES.CONTINUE_TURN:
                            console.log('📋 CONTINUE_TURN: Player keeps turn after capture');
                            this.updateUI('You captured cards and continue your turn!');
                            this.isProcessing = false;
                            break;
                            
                        case GameStateManager.STATES.NEXT_PLAYER:
                            console.log(`📋 NEXT_PLAYER: Advancing to player ${decision.nextPlayer}`);
                            await this.handleNextPlayer(decision.nextPlayer);
                            break;
                            
                        case GameStateManager.STATES.DEAL_NEW_HAND:
                            console.log('📋 DEAL_NEW_HAND: All hands empty, dealing new cards');
                            this.updateUI(`New hand dealt! ${result.cardsRemaining} cards remaining in deck.`);
                            setTimeout(() => this.processGameState(), 1000);
                            break;
                            
                        case GameStateManager.STATES.END_ROUND:
                            console.log('📋 END_ROUND: Round over');
                            this.handleEndRound(result);
                            break;
                            
                        case GameStateManager.STATES.END_GAME:
                            console.log('📋 END_GAME: Game over');
                            this.handleEndGame(result);
                            break;
                            
                        default:
                            console.log('❌ Unknown decision action:', decision.action);
                            this.isProcessing = false;
                    }
                    
                } catch (error) {
                    console.error('❌ Error processing game state:', error);
                    this.isProcessing = false;
                }
            }
            
            async handleNextPlayer(nextPlayer) {
                if (nextPlayer === 0) {
                    this.updateUI('Your turn! Select a card from your hand.');
                    this.isProcessing = false;
                } else {
                    await this.executeAITurn(nextPlayer);
                }
            }
            
            async executeAITurn(playerId) {
                const state = this.gameEngine.getState();
                const player = state.players[playerId];
                
                this.updateUI(`${player.name} is thinking...`);
                
                setTimeout(async () => {
                    try {
                        const aiMove = this.aiPlayers[playerId].makeMove(this.gameEngine, playerId);
                        
                        if (!aiMove) {
                            console.log(`⚠️ AI ${playerId} has no valid moves`);
                            this.processGameState();
                            return;
                        }
                        
                        console.log(`🤖 AI ${playerId} executing:`, aiMove.type);
                        
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
                        
                        setTimeout(() => {
                            this.processGameState();
                        }, 1500);
                        
                    } catch (error) {
                        console.error(`Error in AI ${playerId} turn:`, error);
                        this.processGameState();
                    }
                }, 1000);
            }
            
            handleEndRound(result) {
                if (result.jackpot && result.jackpot.success) {
                    this.updateUI(`${result.jackpot.winner} wins the jackpot! +${result.jackpot.score} points from ${result.jackpot.cards} cards!`);
                } else {
                    this.updateUI('Round ended. No jackpot this time.');
                }
                
                const state = this.gameEngine.getState();
                const winner = state.players.find(player => player.score >= 500);
                
                if (winner) {
                    this.handleEndGame({ winner });
                } else {
                    this.updateUI('Round complete! Start a new game to continue.');
                }
                
                this.isProcessing = false;
            }
            
            handleEndGame(result) {
                this.updateUI(`${result.winner.name} wins the game with ${result.winner.score} points!`);
                if (this.callbacks.onGameEnd) {
                    this.callbacks.onGameEnd(result.winner);
                }
                this.isProcessing = false;
            }
            
            updateUI(message) {
                const state = this.gameEngine.getState();
                
                if (this.callbacks.onStateUpdate) {
                    this.callbacks.onStateUpdate(state);
                }
                
                if (this.callbacks.onMessage && message) {
                    this.callbacks.onMessage(message);
                }
            }
            
            getGameState() {
                return this.gameEngine.getState();
            }
            
            canPlayerMove() {
                const state = this.gameEngine.getState();
                return !this.isProcessing && 
                       state.currentPlayer === 0 && 
                       state.players[0].hand.length > 0;
            }
            
            getAvailableCaptures(handCard) {
                return this.gameEngine.findCaptures(handCard);
            }
            
            validateCapture(handCard, boardCards) {
                return this.gameEngine.validateCapture(handCard, boardCards);
            }
        }
    </script>
    
    <script type="text/babel">
        const { useState, useEffect } = React;

        const StackedGame = () => {
            const [gameState, setGameState] = useState(null);
            const [message, setMessage] = useState('');
            const [selectedHandCard, setSelectedHandCard] = useState(null);
            const [selectedBoardCards, setSelectedBoardCards] = useState([]);
            const [gameController] = useState(new GameController());

            useEffect(() => {
                gameController.setCallbacks({
                    onStateUpdate: (state) => setGameState(state),
                    onMessage: (msg) => setMessage(msg),
                    onGameEnd: (winner) => {
                        setMessage(`🏆 ${winner.name} wins the game with ${winner.score} points!`);
                    }
                });
            }, [gameController]);

            const startGame = () => {
                const initialState = gameController.startGame();
                setSelectedHandCard(null);
                setSelectedBoardCards([]);
            };

            const selectHandCard = (card) => {
                if (!gameController.canPlayerMove()) return;
                setSelectedHandCard(selectedHandCard?.id === card.id ? null : card);
                setSelectedBoardCards([]);
            };

            const selectBoardCard = (card) => {
                if (!selectedHandCard || !gameController.canPlayerMove()) return;
                const isSelected = selectedBoardCards.some(c => c.id === card.id);
                if (isSelected) {
                    setSelectedBoardCards(selectedBoardCards.filter(c => c.id !== card.id));
                } else {
                    setSelectedBoardCards([...selectedBoardCards, card]);
                }
            };

            const captureCards = () => {
                if (!selectedHandCard || selectedBoardCards.length === 0) return;
                if (!gameController.validateCapture(selectedHandCard, selectedBoardCards)) {
                    setMessage('Invalid capture!');
                    return;
                }
                
                gameController.handlePlayerAction({
                    type: 'capture',
                    handCard: selectedHandCard,
                    boardCards: selectedBoardCards
                });
                
                setSelectedHandCard(null);
                setSelectedBoardCards([]);
            };

            const placeCard = () => {
                if (!selectedHandCard) return;
                
                gameController.handlePlayerAction({
                    type: 'place',
                    handCard: selectedHandCard
                });
                
                setSelectedHandCard(null);
            };

            const Card = ({ card, onClick, selected, size = 'normal' }) => {
                const isRed = ['♥', '♦'].includes(card.suit);
                const sizes = { small: 'w-10 h-14 text-xs', normal: 'w-12 h-16 text-sm', large: 'w-14 h-20 text-base' };
                
                return React.createElement('div', {
                    onClick: onClick,
                    className: `${sizes[size]} ${isRed ? 'text-red-600' : 'text-black'} ${selected ? 'bg-blue-200 border-blue-500' : 'bg-white border-gray-300'} border-2 rounded-lg flex flex-col items-center justify-between p-1 font-bold shadow-sm cursor-pointer hover:shadow-md transition-all`
                }, [
                    React.createElement('div', { key: 'rank', className: 'text-xs' }, card.rank),
                    React.createElement('div', { key: 'suit', className: 'text-lg' }, card.suit),
                    React.createElement('div', { key: 'score', className: 'text-xs' }, card.score)
                ]);
            };

            if (!gameState) {
                return React.createElement('div', {
                    className: 'min-h-screen bg-gradient-to-br from-green-600 to-green-800 text-white p-4 flex items-center justify-center'
                }, [
                    React.createElement('div', { key: 'start-screen', className: 'text-center' }, [
                        React.createElement('h1', { key: 'title', className: 'text-6xl font-bold mb-8' }, 'STACKED!'),
                        React.createElement('p', { key: 'subtitle', className: 'text-xl mb-8 opacity-75' }, 'Clean Architecture Implementation'),
                        React.createElement('button', {
                            key: 'start-btn',
                            onClick: startGame,
                            className: 'bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-lg font-bold text-lg transition-colors'
                        }, 'Start Game')
                    ])
                ]);
            }

            return React.createElement('div', {
                className: 'min-h-screen bg-gradient-to-br from-green-600 to-green-800 text-white p-4'
            }, [
                React.createElement('div', { key: 'container', className: 'max-w-4xl mx-auto' }, [
                    React.createElement('h1', { key: 'title', className: 'text-4xl font-bold text-center mb-6' }, 'STACKED!'),
                    
                    React.createElement('div', { key: 'message', className: 'bg-white/10 backdrop-blur rounded-lg p-4 text-center mb-6' },
                        React.createElement('p', { className: 'font-semibold' }, message)
                    ),
                    
                    React.createElement('div', { key: 'deck-info', className: 'bg-white/10 backdrop-blur rounded-lg p-3 text-center mb-6' },
                        React.createElement('p', { className: 'font-bold' }, `Deck: ${gameState.deck.length} cards remaining`)
                    ),
                    
                    React.createElement('div', { key: 'scores', className: 'grid grid-cols-3 gap-4 mb-6' },
                        gameState.players.map(player =>
                            React.createElement('div', {
                                key: player.id,
                                className: `bg-white/10 backdrop-blur rounded-lg p-3 text-center ${gameState.currentPlayer === player.id ? 'ring-2 ring-yellow-400' : ''}`
                            }, [
                                React.createElement('div', { key: 'name', className: 'font-bold' }, player.name),
                                React.createElement('div', { key: 'score', className: 'text-2xl font-bold text-yellow-300' }, player.score),
                                React.createElement('div', { key: 'cards', className: 'text-sm opacity-75' }, `${player.hand.length} cards`)
                            ])
                        )
                    ),
                    
                    React.createElement('div', { key: 'board', className: 'bg-white/10 backdrop-blur rounded-lg p-4 mb-6' }, [
                        React.createElement('h3', { key: 'board-title', className: 'font-bold mb-3' }, 'Board Cards'),
                        React.createElement('div', { key: 'board-cards', className: 'flex flex-wrap gap-2 min-h-20' },
                            gameState.board.map(card =>
                                React.createElement(Card, {
                                    key: card.id,
                                    card: card,
                                    onClick: () => selectBoardCard(card),
                                    selected: selectedBoardCards.some(c => c.id === card.id)
                                })
                            )
                        )
                    ]),
                    
                    React.createElement('div', { key: 'hand', className: 'bg-white/10 backdrop-blur rounded-lg p-4 mb-6' }, [
                        React.createElement('h3', { key: 'hand-title', className: 'font-bold mb-3' }, 'Your Hand'),
                        React.createElement('div', { key: 'hand-cards', className: 'flex flex-wrap gap-2 justify-center' },
                            gameState.players[0]?.hand.map(card =>
                                React.createElement(Card, {
                                    key: card.id,
                                    card: card,
                                    onClick: () => selectHandCard(card),
                                    selected: selectedHandCard?.id === card.id,
                                    size: 'large'
                                })
                            ) || []
                        )
                    ]),
                    
                    selectedHandCard && gameController.canPlayerMove() ?
                        React.createElement('div', { key: 'actions', className: 'flex gap-4 justify-center' }, [
                            React.createElement('button', {
                                key: 'capture',
                                onClick: captureCards,
                                disabled: selectedBoardCards.length === 0 || !gameController.validateCapture(selectedHandCard, selectedBoardCards),
                                className: 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:opacity-50 px-6 py-3 rounded-lg font-bold transition-colors'
                            }, `Capture (${selectedBoardCards.length})`),
                            React.createElement('button', {
                                key: 'place',
                                onClick: placeCard,
                                className: 'bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-bold transition-colors'
                            }, 'Place Card')
                        ]) : null
                ])
            ]);
        };

        ReactDOM.render(React.createElement(StackedGame), document.getElementById('root'));
    </script>
</body>
</html>