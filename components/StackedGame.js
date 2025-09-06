import React, { useState, useEffect, useCallback } from 'react';
import { Shuffle, Play, RotateCcw } from 'lucide-react';

const StackedGame = () => {
  // Card scoring system from your rules
  const getCardScore = (rank) => {
    if (rank === 'A') return 15;
    if (['K', 'Q', 'J', '10'].includes(rank)) return 10;
    return 5; // 2-9
  };

  // Create and shuffle deck
  const createDeck = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = suits.flatMap(suit => 
      ranks.map(rank => ({ 
        id: `${rank}${suit}`, 
        rank, 
        suit, 
        score: getCardScore(rank),
        numValue: rank === 'A' ? 1 : isNaN(parseInt(rank)) ? 0 : parseInt(rank)
      }))
    );
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  // Game state
  const [deck, setDeck] = useState([]);
  const [players, setPlayers] = useState([]);
  const [boardCards, setBoardCards] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [selectedHandCard, setSelectedHandCard] = useState(null);
  const [selectedBoardCards, setSelectedBoardCards] = useState([]);
  const [gamePhase, setGamePhase] = useState('setup'); // setup, playing, gameOver
  const [message, setMessage] = useState('');
  const [gameStarted, setGameStarted] = useState(false);

  // Initialize new game
  const startGame = () => {
    const newDeck = createDeck();
    
    // Create 3 players
    const newPlayers = Array.from({ length: 3 }, (_, i) => ({
      id: i,
      name: i === 0 ? 'You' : `AI ${i}`,
      hand: newDeck.slice(i * 4, (i + 1) * 4),
      captured: [],
      score: 0,
      isHuman: i === 0
    }));
    
    // 4 cards on board
    const initialBoard = newDeck.slice(12, 16);
    const remainingDeck = newDeck.slice(16);
    
    setPlayers(newPlayers);
    setBoardCards(initialBoard);
    setDeck(remainingDeck);
    setCurrentPlayer(0);
    setGamePhase('playing');
    setGameStarted(true);
    setSelectedHandCard(null);
    setSelectedBoardCards([]);
    setMessage('Your turn! Select a card from your hand, then select board cards to capture or trail.');
  };

  // Check if cards can be captured together
  const canCapture = (handCard, boardCards) => {
    if (boardCards.length === 0) return false;
    
    // Simple pair capture - any board card matches hand card rank
    const pairCapture = boardCards.some(card => card.rank === handCard.rank);
    if (pairCapture && boardCards.every(card => card.rank === handCard.rank)) {
      return true;
    }
    
    // Sum capture - board cards add up to hand card value
    if (handCard.numValue > 0) { // Only number cards can be summed to
      const boardSum = boardCards.reduce((sum, card) => sum + (card.numValue || 0), 0);
      if (boardSum === handCard.numValue && boardCards.every(card => card.numValue > 0)) {
        return true;
      }
    }
    
    return false;
  };

  // Handle card selection from hand
  const selectHandCard = (card) => {
    if (currentPlayer !== 0 || gamePhase !== 'playing') return;
    
    setSelectedHandCard(selectedHandCard?.id === card.id ? null : card);
    setSelectedBoardCards([]);
    setMessage(selectedHandCard?.id === card.id ? 
      'Select a card from your hand to play.' : 
      `Selected ${card.rank}${card.suit}. Now select board cards to capture, or click Trail to place on board.`
    );
  };

  // Handle board card selection
  const selectBoardCard = (card) => {
    if (!selectedHandCard || currentPlayer !== 0) return;
    
    const isSelected = selectedBoardCards.some(c => c.id === card.id);
    let newSelection;
    
    if (isSelected) {
      newSelection = selectedBoardCards.filter(c => c.id !== card.id);
    } else {
      newSelection = [...selectedBoardCards, card];
    }
    
    setSelectedBoardCards(newSelection);
  };

  // Execute capture move
  const captureCards = () => {
    if (!selectedHandCard || selectedBoardCards.length === 0) return;
    
    if (!canCapture(selectedHandCard, selectedBoardCards)) {
      setMessage('Invalid capture! Cards must match rank or sum to your hand card value.');
      return;
    }
    
    const newPlayers = [...players];
    const player = newPlayers[currentPlayer];
    
    // Remove hand card and add all captured cards
    player.hand = player.hand.filter(c => c.id !== selectedHandCard.id);
    const capturedCards = [selectedHandCard, ...selectedBoardCards];
    player.captured.push(...capturedCards);
    player.score += capturedCards.reduce((sum, card) => sum + card.score, 0);
    
    // Remove captured cards from board
    setBoardCards(boardCards.filter(card => 
      !selectedBoardCards.some(selected => selected.id === card.id)
    ));
    
    setMessage(`Captured ${capturedCards.length} cards for ${capturedCards.reduce((sum, card) => sum + card.score, 0)} points!`);
    setPlayers(newPlayers);
    
    // Continue turn - player can capture again
    setSelectedHandCard(null);
    setSelectedBoardCards([]);
    
    // Check if player is out of cards
    if (player.hand.length === 0) {
      nextPlayer();
    }
  };

  // Trail a card to the board
  const trailCard = () => {
    if (!selectedHandCard) return;
    
    const newPlayers = [...players];
    const player = newPlayers[currentPlayer];
    
    // Remove card from hand and add to board
    player.hand = player.hand.filter(c => c.id !== selectedHandCard.id);
    setBoardCards([...boardCards, selectedHandCard]);
    setPlayers(newPlayers);
    
    setMessage(`Trailed ${selectedHandCard.rank}${selectedHandCard.suit} to the board.`);
    setSelectedHandCard(null);
    setSelectedBoardCards([]);
    
    nextPlayer();
  };

  // Move to next player
  const nextPlayer = () => {
    const nextPlayerIndex = (currentPlayer + 1) % 3;
    setCurrentPlayer(nextPlayerIndex);
    
    // Check win condition
    const currentPlayerData = players[currentPlayer];
    if (currentPlayerData && currentPlayerData.score >= 500) {
      setGamePhase('gameOver');
      setMessage(`${currentPlayerData.name} wins with ${currentPlayerData.score} points!`);
      return;
    }
    
    // AI turn
    if (nextPlayerIndex !== 0) {
      setTimeout(() => playAITurn(nextPlayerIndex), 1000);
    } else {
      setMessage('Your turn! Select a card to play.');
    }
  };

  // Simple AI logic
  const playAITurn = (playerIndex) => {
    const player = players[playerIndex];
    if (!player || player.hand.length === 0) {
      nextPlayer();
      return;
    }
    
    // Try to find a capture
    let bestCapture = null;
    let bestScore = 0;
    
    for (const handCard of player.hand) {
      // Try pair captures
      const pairCards = boardCards.filter(card => card.rank === handCard.rank);
      if (pairCards.length > 0) {
        const score = (handCard.score + pairCards.reduce((sum, card) => sum + card.score, 0));
        if (score > bestScore) {
          bestCapture = { handCard, boardCards: pairCards };
          bestScore = score;
        }
      }
      
      // Try sum captures (only for number cards)
      if (handCard.numValue > 0) {
        for (let i = 1; i < (1 << boardCards.length); i++) {
          const subset = boardCards.filter((_, index) => (i >> index) & 1);
          if (subset.every(card => card.numValue > 0)) {
            const sum = subset.reduce((total, card) => total + card.numValue, 0);
            if (sum === handCard.numValue) {
              const score = handCard.score + subset.reduce((total, card) => total + card.score, 0);
              if (score > bestScore) {
                bestCapture = { handCard, boardCards: subset };
                bestScore = score;
              }
            }
          }
        }
      }
    }
    
    const newPlayers = [...players];
    const aiPlayer = newPlayers[playerIndex];
    
    if (bestCapture) {
      // Execute capture
      aiPlayer.hand = aiPlayer.hand.filter(c => c.id !== bestCapture.handCard.id);
      const capturedCards = [bestCapture.handCard, ...bestCapture.boardCards];
      aiPlayer.captured.push(...capturedCards);
      aiPlayer.score += capturedCards.reduce((sum, card) => sum + card.score, 0);
      
      setBoardCards(boardCards.filter(card => 
        !bestCapture.boardCards.some(selected => selected.id === card.id)
      ));
      
      setMessage(`${aiPlayer.name} captured ${capturedCards.length} cards for ${capturedCards.reduce((sum, card) => sum + card.score, 0)} points!`);
      setPlayers(newPlayers);
      
      // AI continues turn if they still have cards
      if (aiPlayer.hand.length > 0) {
        setTimeout(() => playAITurn(playerIndex), 800);
      } else {
        setTimeout(() => nextPlayer(), 1000);
      }
    } else {
      // Trail lowest card
      const lowestCard = aiPlayer.hand.reduce((lowest, card) => 
        card.score < lowest.score ? card : lowest
      );
      
      aiPlayer.hand = aiPlayer.hand.filter(c => c.id !== lowestCard.id);
      setBoardCards([...boardCards, lowestCard]);
      setPlayers(newPlayers);
      
      setMessage(`${aiPlayer.name} trailed ${lowestCard.rank}${lowestCard.suit}.`);
      
      setTimeout(() => nextPlayer(), 1000);
    }
  };

  // Card component
  const Card = ({ card, onClick, selected, size = 'normal', disabled = false }) => {
    const isRed = ['♥', '♦'].includes(card.suit);
    
    const sizeClasses = {
      small: 'w-10 h-14 text-xs',
      normal: 'w-12 h-16 text-sm',
      large: 'w-14 h-20 text-base'
    };
    
    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={`
          ${sizeClasses[size]} 
          ${isRed ? 'text-red-600' : 'text-black'}
          ${selected ? 'bg-blue-200 border-blue-500' : 'bg-white border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          border-2 rounded-lg flex flex-col items-center justify-between p-1 font-bold shadow-sm transition-all
        `}
      >
        <div className="text-xs">{card.rank}</div>
        <div className="text-lg">{card.suit}</div>
        <div className="text-xs">{card.score}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 text-white">
      <div className="container mx-auto p-4 max-w-6xl">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">STACKED!</h1>
          <p className="text-green-200">First to 500 points wins</p>
        </header>

        {!gameStarted ? (
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur rounded-xl p-8 max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-4">Ready to Play?</h2>
              <p className="mb-6 text-green-100">3 players • Capture cards by matching ranks or summing values</p>
              <button
                onClick={startGame}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-lg font-bold text-lg flex items-center gap-2 mx-auto transition-colors"
              >
                <Shuffle size={24} />
                Start Game
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Game Message */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
              <p className="font-semibold">{message}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-3 gap-4">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`
                    bg-white/10 backdrop-blur rounded-lg p-3 text-center
                    ${index === currentPlayer ? 'ring-2 ring-yellow-400' : ''}
                  `}
                >
                  <div className="font-bold">{player.name}</div>
                  <div className="text-2xl font-bold text-yellow-300">{player.score}</div>
                  <div className="text-xs opacity-75">Cards: {player.hand.length}</div>
                </div>
              ))}
            </div>

            {/* Board Cards */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <h3 className="font-bold mb-3">Board Cards</h3>
              <div className="flex flex-wrap gap-2 min-h-20">
                {boardCards.map(card => (
                  <Card
                    key={card.id}
                    card={card}
                    onClick={() => selectBoardCard(card)}
                    selected={selectedBoardCards.some(c => c.id === card.id)}
                    disabled={currentPlayer !== 0}
                  />
                ))}
              </div>
            </div>

            {/* Human Player Hand */}
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <h3 className="font-bold mb-3">Your Hand</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {players[0]?.hand.map(card => (
                  <Card
                    key={card.id}
                    card={card}
                    onClick={() => selectHandCard(card)}
                    selected={selectedHandCard?.id === card.id}
                    size="large"
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {currentPlayer === 0 && selectedHandCard && gamePhase === 'playing' && (
              <div className="flex gap-4 justify-center">
                <button
                  onClick={captureCards}
                  disabled={selectedBoardCards.length === 0 || !canCapture(selectedHandCard, selectedBoardCards)}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:opacity-50 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                  <Play size={20} />
                  Capture ({selectedBoardCards.length})
                </button>
                <button
                  onClick={trailCard}
                  className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-bold transition-colors"
                >
                  Trail Card
                </button>
              </div>
            )}

            {/* New Game Button */}
            <div className="text-center">
              <button
                onClick={startGame}
                className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 mx-auto transition-colors"
              >
                <RotateCcw size={18} />
                New Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StackedGame;