const { v4: uuidv4 } = require('uuid');

const matches = [];

// Function to add a new match
function addMatch() {
    const match = {
      id: uuidv4(), // Generate a unique ID for the match
      players: [], // Array to hold player objects
      state: 'pregame', // Match state
      gameTime: 0,
      events: [] // Array to hold match events
    };
    matches.push(match);
    return match.id;
  }

// Function to add a player to a match
function addPlayer(matchId, playerId) {
  const player = {
    id: playerId,
    events: [],
  };
  const match = matches.find(m => m.id === matchId);
  if (match) {
    match.players.push(player);
    return true;
  }
  return false;
}

// Function to remove a player from a match
function removePlayer(matchId, playerId) {
  const match = matches.find(m => m.id === matchId);
  if (match) {
    const playerIndex = match.players.findIndex(p => p.id === playerId);
    if (playerIndex >= 0) {
      match.players.splice(playerIndex, 1);
      return true;
    }
  }
  return false;
}

// Function to update the state of a match
function updateMatchState(matchId, newState) {
  const match = matches.find(m => m.id === matchId);
  if (match) {
    match.state = newState;
    return true;
  }
  return false;
}

// Function to add an event to a match
function addMatchEvent(matchId, event) {
  const match = matches.find(m => m.id === matchId);
  if (match) {
    match.events.push(event);
    return true;
  }
  return false;
}

// Function to get the events for a specific match and player
function getMatchByPlayer(playerId) {
  return matches.find(match => {
    return match.players.some(player => {
      return player.id === playerId;
    });
  });
}

// Function to get the events for a specific match and player
function getMatchEvents(matchId, playerId) {
  const match = matches.find(m => m.id === matchId);
  if (match) {
    // Return all events for the match if the player ID is not provided
    if (!playerId) {
      return match.events;
    }
    // Filter events to only those relating to the specified player
    return match.events.filter(event => event.playerId === playerId);
  }
  return false;
}
  
  
// Function to add player state to match
function addPlayerEvent(matchId, playerId, tick, event) {
  const match = matches.find(m => m.id === matchId);
  if (match) {
    const player = match.players.find(p => p.id === playerId);

    player.events.push(event);
    return true;
  }
  return false;
}

module.exports = {
  addMatch,
  addMatchEvent,
  addPlayer,
  addPlayerEvent,
  getMatchByPlayer
};