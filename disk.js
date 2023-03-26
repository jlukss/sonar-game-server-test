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
let currentAuthorativePlayer = "";
let lastDiskState = 0;

const reset = () => {
    diskStates = { 
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
    playerDiskStates = {};
    authorityHistory = {};
    currentAuthorativePlayer = "";
    lastDiskState = 0;

    console.log("Disk reset");
}

const addDiskState = (playerId, gameTick, diskState) => {
    if(lastDiskState < gameTick) {
        lastDiskState = gameTick;
    }

    if (diskState.playerHolding !== "" && diskState.playerHolding !== currentAuthorativePlayer) {
        changeDiskAuthority(gameTick, diskState.playerHolding);
    }

    if(currentAuthorativePlayer == "") 
    {
        changeDiskAuthority(gameTick, playerId);
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

const changeDiskAuthority = (gameTick, playerId) => {
    authorityHistory[gameTick] = currentAuthorativePlayer;
    currentAuthorativePlayer = playerId;
    for (tick = gameTick + 1; tick < lastDiskState; tick++) {
        if (diskStates.hasOwnProperty(tick)) {
            delete diskStates[tick];
        }
    }
    lastDiskState = gameTick;
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

const getCurrentAuthority = () => {
    return currentAuthorativePlayer;
}

module.exports = {
    addDiskState,
    changeDiskAuthority,
    removeAuthority,
    getDiskStatesFrom,
    getCurrentAuthority,
    reset
}