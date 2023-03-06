let playerInputs = {};
let lastClientTime = {};

const addPlayerState = (playerId, gameTick, state) => {
    state.simulated = false;
    if(!playerInputs.hasOwnProperty(playerId))
    {
        playerInputs[playerId] = {
            lastReceivedTick: gameTick,
            gameStates: {
                gameTick: state
            }
        }
    } else {
        if (Object.keys(playerInputs[playerId].gameStates).length == global.gameTicksToKeep) 
        {
            const sortedKeys = Object.keys(playerInputs[playerId].gameStates).sort((a, b) => a - b);
            delete playerInputs[playerId].gameStates[sortedKeys[0]];
        }

        playerInputs[playerId].gameStates[gameTick] = state;
        playerInputs[playerId].lastReceivedTick = gameTick;
    }
}

const getPlayerLastInputGameTick = () => {
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
                if (Object.hasOwnProperty.call(playerInputs[playerId].gameStates, gameTick)) {
                    const state = playerInputs[playerId].gameStates[gameTick];
                    if (!result.hasOwnProperty(gameTick)) {
                        result[gameTick] = {
                            playerId: state
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

const setPlayerLastClientTime = (playerId, clientTime) => {
    if (!lastClientTime.hasOwnProperty(playerId) || lastClientTime[playerId] < clientTime) {
        lastClientTime[playerId] = clientTime;
    }
}

const getPlayerLastClientTime = (playerId) => {
    if (lastClientTime.hasOwnProperty(playerId)) {
        return lastClientTime[playerId];
    }

    return 0;
}

module.exports = {
    addPlayerState,
    getPlayerLastInputGameTick,
    getPlayerStatesFrom,
    setPlayerLastClientTime,
    getPlayerLastClientTime
};