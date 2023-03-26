const MAX_PING_MEASUREMENTS = 10;

let playerInputs = {};
let lastClientTime = {};
let ticksOffsetHistory = {};
let clientPingsHistory = {};
let lastReceivedTick = {};
let lastPlayerInput = {};

const reset = () => {
    playerInputs = {};
    lastClientTime = {};
    ticksOffsetHistory = {};
    clientPingsHistory = {};
    lastReceivedTick = {};
    lastPlayerInput = {};

    console.log('Player inputs reset');
}

const addPlayerState = (playerId, gameTick, state) => {
    if(!playerInputs.hasOwnProperty(playerId))
    {
        playerInputs[playerId] = {
            [gameTick]: state
        }

        lastPlayerInput[playerId] = gameTick;

        return;
    }

    if (playerInputs[playerId].hasOwnProperty(gameTick)) {
        return;
    }

    playerInputs[playerId][gameTick] = state;

    if (Object.keys(playerInputs[playerId]).length == global.gameTicksToKeep) 
    {
        const sortedKeys = Object.keys(playerInputs[playerId]).sort((a, b) => a - b);
        delete playerInputs[playerId][sortedKeys[0]];
    }

    if (lastPlayerInput[playerId] < gameTick) {
        lastPlayerInput[playerId] = gameTick;
    }
}

const setPlayerLastInputGameTick = (playerId, gameTick) => {    
    if (!lastReceivedTick.hasOwnProperty(playerId)) {
        lastReceivedTick[playerId] = gameTick;

        return;
    }

    if (lastReceivedTick[playerId] < gameTick) {
        lastReceivedTick[playerId] = parseInt(gameTick);
    }
}

const getPlayerLastInputGameTick = (playerId) => {
    if(!lastReceivedTick.hasOwnProperty(playerId)) {
        return 0
    }

    let latestInput = lastReceivedTick[playerId];

    Object.keys(lastPlayerInput).forEach(pid => {
        let gameTick = lastPlayerInput[pid];
        if (pid !== playerId && gameTick < latestInput) {
            latestInput = gameTick;
        }
    });

    return latestInput;
}

const getPlayerStatesFrom = (fromGameTick) => {
    let result = {};

    for (const playerId in playerInputs) {
        for (const gameTick in playerInputs[playerId]) {
            if ((gameTick >= fromGameTick) && (Object.hasOwnProperty.call(playerInputs[playerId], gameTick))) {
                const state = playerInputs[playerId][gameTick];
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
  
    return Math.round(weightedSum / weightSum);
}

const removePlayer = (playerId) => {
    if (playerInputs.hasOwnProperty(playerId)) {
        delete playerInputs[playerId];
    }

    if (lastClientTime.hasOwnProperty(playerId)) {
        delete lastClientTime[playerId];
    }

    if (lastReceivedTick.hasOwnProperty(playerId)) {
        delete lastReceivedTick[playerId];
    }

    if(ticksOffsetHistory.hasOwnProperty(playerId)) {
        delete ticksOffsetHistory[playerId];
    }

    if(clientPingsHistory.hasOwnProperty(playerId)) {
        delete clientPingsHistory[playerId];
    }

    if(lastPlayerInput.hasOwnProperty(playerId)) {
        delete lastPlayerInput[playerId];
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