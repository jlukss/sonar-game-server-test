const MAX_PING_MEASUREMENTS = 10;

let playerInputs = {};
let lastClientTime = {};
let ticksOffsetHistory = {};
let clientPingsHistory = {};

const reset = () => {
    playerInputs = {};
    lastClientTime = {};
    ticksOffsetHistory = {};
    clientPingsHistory = {};

    console.log('Player inputs reset');
}

const addPlayerState = (playerId, gameTick, state) => {
    if(!playerInputs.hasOwnProperty(playerId))
    {
        playerInputs[playerId] = {
            lastReceivedTick: 0,
            gameStates: {
                [gameTick]: state
            }
        }
    } else {
        if (Object.keys(playerInputs[playerId].gameStates).length == global.gameTicksToKeep) 
        {
            const sortedKeys = Object.keys(playerInputs[playerId].gameStates).sort((a, b) => a - b);
            delete playerInputs[playerId].gameStates[sortedKeys[0]];
        }

        playerInputs[playerId].gameStates[gameTick] = state;
    }
}

const setPlayerLastInputGameTick = (playerId, gameTick) => {    
    if (!playerInputs.hasOwnProperty(playerId)) {
        playerInputs[playerId] = {
            lastReceivedTick: 0,
            gameStates: {}
        }
    }
    if (playerInputs[playerId].lastReceivedTick < gameTick) {
        playerInputs[playerId].lastReceivedTick = parseInt(gameTick);
    }
}

const getPlayerLastInputGameTick = (playerId) => {
    if(!playerInputs.hasOwnProperty(playerId)) {
        return 0
    }

    return playerInputs[playerId].lastReceivedTick;
}

const getPlayerStatesFrom = (fromGameTick) => {
    let result = {};

    for (const playerId in playerInputs) {
        if (Object.hasOwnProperty.call(playerInputs, playerId)) {
            for (const gameTick in playerInputs[playerId].gameStates) {
                if ((gameTick >= fromGameTick) && (Object.hasOwnProperty.call(playerInputs[playerId].gameStates, gameTick))) {
                    const state = playerInputs[playerId].gameStates[gameTick];
                    if (!result.hasOwnProperty(gameTick)) {
                        result[gameTick] = {
                            [playerId]: state
                        }
                    } else {
                        result[gameTick][playerId] = state;
                    }
                }
            }
            
        }
    }

    return result;
}

const setPlayerLastClientTime = (playerId, clientTime, messageTime, clientPing, ticksAhead) => {
    if (!lastClientTime.hasOwnProperty(playerId) || lastClientTime[playerId] < clientTime) {
        lastClientTime[playerId] = [clientTime, messageTime];
    }

    if (!clientPingsHistory.hasOwnProperty(playerId)) {
        clientPingsHistory[playerId] = [clientPing];
        ticksOffsetHistory[playerId] = [ticksAhead];
    } else {
        clientPingsHistory[playerId].push(clientPing);
        ticksOffsetHistory[playerId].push(ticksAhead);
    }
    if (clientPingsHistory.length > MAX_PING_MEASUREMENTS) {
        clientPingsHistory.shift();
        ticksOffsetHistory.shift();
      }
}

const getPlayerLastClientTime = (playerId, serverTime) => {
    if (lastClientTime.hasOwnProperty(playerId)) {
        let clientTime = lastClientTime[playerId][0];
        let timeInBuffer = serverTime - lastClientTime[playerId][1];
        return clientTime + timeInBuffer;
    }

    return 0;
}

const getEstimatedTicksAhead = (playerId) => {
    let weightedSum = 0;
    let weightSum = 0;

    if (!clientPingsHistory.hasOwnProperty(playerId)) {
        return 0;
    }
  
    for (let i = 0; i < ticksOffsetHistory[playerId].length; i++) {
      const timeOffset = ticksOffsetHistory[playerId][i];
      const rtt = clientPingsHistory[playerId][i];
      const weight = 1 / rtt;
  
      weightedSum += timeOffset * weight;
      weightSum += weight;
    }
  
    return round(weightedSum / weightSum);
}

const removePlayer = (playerId) => {
    if (playerInputs.hasOwnProperty(playerId)) {
        delete playerInputs[playerId];
    }

    if (lastClientTime.hasOwnProperty(playerId)) {
        delete lastClientTime[playerId];
    }
}

module.exports = {
    reset,
    addPlayerState,
    setPlayerLastInputGameTick,
    getPlayerLastInputGameTick,
    getEstimatedTicksAhead,
    getPlayerStatesFrom,
    setPlayerLastClientTime,
    getPlayerLastClientTime,
    removePlayer
};