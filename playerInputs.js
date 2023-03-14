let playerInputs = {};
let lastClientTime = {};

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

const setPlayerLastClientTime = (playerId, clientTime, messageTime, ticksAhead) => {
    if (!lastClientTime.hasOwnProperty(playerId) || lastClientTime[playerId] < clientTime) {
        lastClientTime[playerId] = [clientTime, messageTime, ticksAhead];
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
    if (lastClientTime.hasOwnProperty(playerId)) {
        return lastClientTime[playerId][2];
    }
    return 0;
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
    addPlayerState,
    setPlayerLastInputGameTick,
    getPlayerLastInputGameTick,
    getEstimatedTicksAhead,
    getPlayerStatesFrom,
    setPlayerLastClientTime,
    getPlayerLastClientTime,
    removePlayer
};