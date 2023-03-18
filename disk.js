let diskStates = {
    0: {
        "bSimulated": false,
        "velocity":{
            "x":0.0000000000000000,
            "y":0.0000000000000000,
            "z":0.0000000000000000
        },
        "position":{
            "x":0.0000000000000000,
            "y":0.0000000000000000,
            "z":0.0000000000000000
        },
        "rotation":{
            "x":0.0000000000000000,
            "y":0.0000000000000000,
            "z":0.0000000000000000
        },
        "rotationVelocity":{
            "x":0.0000000000000000,
            "y":0.0000000000000000,
            "z":0.0000000000000000
        },
        "speed":0.0
    }
};
let playerDiskStates = {};
let authorityHistory = {};
let authorityAheadOfServerTicks = 0;
let currentAuthorativePlayer = "";

const addDiskState = (playerId, gameTick, diskState, estimatedAhead) => {
    if (diskState.playerHodling != currentAuthorativePlayer) {
        changeDiskAuthority(gameTick, diskState.playerHodling, estimatedAhead);
    }

    if(currentAuthorativePlayer == "") 
    {
        changeDiskAuthority(gameTick, playerId, estimatedAhead);
    }
    diskState.bSimulated = true;

    if (currentAuthorativePlayer == playerId) {        
        authorityHistory[gameTick] = playerId;
        diskState.bSimulated = false;

        if (Object.keys(diskStates).length == global.gameTicksToKeep)
        {
            const sortedKeys = Object.keys(diskStates).sort((a, b) => a - b);
            delete diskStates[sortedKeys[0]];
        }

        diskStates[gameTick] = diskState;
    }

    if (!diskStates.hasOwnProperty(playerId))
    {
        playerDiskStates[playerId] = {
            gameTick: diskState
        }
    } else {
        if (Object.keys(playerDiskStates[playerId]).length == global.gameTicksToKeep)
        {
            const sortedKeys = Object.keys(playerDiskStates[playerId]).sort((a, b) => a - b);
            delete playerDiskStates[playerId][sortedKeys[0]];
        }
        playerDiskStates[playerId][gameTick] = diskState;
    }
}
const removeAuthority = (playerId) => {
    if (playerId == currentAuthorativePlayer) {
        currentAuthorativePlayer = "";
    }
}

const changeDiskAuthority = (gameTick, playerId, estimatedAhead) => {
    authorityHistory[gameTick] = currentAuthorativePlayer;
    currentAuthorativePlayer = playerId;
    authorityAheadOfServerTicks = parseInt(estimatedAhead);
}

const getDiskStatesFrom = (fromGameTick) => {
    const sortedKeys = Object.keys(diskStates).sort((a, b) => a - b);
    let result = {};

    sortedKeys.forEach(gameTick => {
        if (gameTick >= fromGameTick) {
            result[gameTick] = diskStates[gameTick];
        }
    });

    return result;
}

const getEstimatedGameTime = (latestReceivedTick) => {
    return parseInt(latestReceivedTick) + authorityAheadOfServerTicks;
}

module.exports = {
    addDiskState,
    changeDiskAuthority,
    removeAuthority,
    getDiskStatesFrom,
    getEstimatedGameTime
}