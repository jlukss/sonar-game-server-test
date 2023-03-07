let diskStates = {
    0: {
        "simulated": false,
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
let currentAuthorativePlayer = "";

const addDiskState = (playerId, gameTick, diskState) => {
    if(currentAuthorativePlayer == "") 
    {
        changeDiskAuthority(gameTick, playerId);
    }
    diskState.simulated = true;

    if (currentAuthorativePlayer == playerId) {        
        authorityHistory[gameTick] = playerId;
        diskState.simulated = false;

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

const changeDiskAuthority = (gameTick, playerId) => {
    authorityHistory[gameTick] = currentAuthorativePlayer;
    currentAuthorativePlayer = playerId;
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

module.exports = {
    addDiskState,
    changeDiskAuthority,
    getDiskStatesFrom
}