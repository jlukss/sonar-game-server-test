export interface DiskState {
    bSimulated: boolean;
    velocity: {
      x: number;
      y: number;
      z: number;
    };
    position: {
      x: number;
      y: number;
      z: number;
    };
    rotation: {
      x: number;
      y: number;
      z: number;
    };
    rotationVelocity: {
      x: number;
      y: number;
      z: number;
    };
    speed: number;
    playerHolding: string;
  }


interface PlayerDiskStates {
    [key: string]: {
        [key: number]: DiskState;
    };
}

interface AuthorityHistory {
    [key: number]: string;
}

let diskStates: {
    [gameTimeTick: number]: DiskState;
} = {
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
        "speed":0.0,
        "playerHolding": ""
    }
};
let playerDiskStates: PlayerDiskStates = {};
let authorityHistory: AuthorityHistory = {};
let currentAuthorativePlayer: string = "";
let lastDiskState: number = 0;

export const disk = {
    reset() {
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
                "speed":0.0,
                "playerHolding": ""
            }
        };
        playerDiskStates = {};
        authorityHistory = {};
        currentAuthorativePlayer = "";
        lastDiskState = 0;

        console.log("Disk reset");
    },

    addDiskState(playerId: string, gameTick: number, diskState: DiskState) {
        if(lastDiskState < gameTick) {
            lastDiskState = gameTick;
        }

        if (diskState.playerHolding !== "" && diskState.playerHolding !== currentAuthorativePlayer) {
            disk.changeDiskAuthority(gameTick, diskState.playerHolding);
        }

        if(currentAuthorativePlayer == "") 
        {
            disk.changeDiskAuthority(gameTick, playerId);
        }
        diskState.bSimulated = true;

        if (currentAuthorativePlayer == playerId) {        
            authorityHistory[gameTick] = playerId;
            diskState.bSimulated = false;

            if (Object.keys(diskStates).length == global.gameTicksToKeep)
            {
                const sortedKeys: string[] = Object.keys(diskStates).sort((a: string, b: string) => Number(a) - Number(b));
                delete diskStates[Number(sortedKeys[0])];
            }

            diskStates[gameTick] = diskState;
        }

        if (!diskStates.hasOwnProperty(playerId))
        {
            playerDiskStates[playerId] = {
                [gameTick]: diskState
            }
        } else {
            if (Object.keys(playerDiskStates[playerId]).length == global.gameTicksToKeep)
            {
                const sortedKeys: string[] = Object.keys(playerDiskStates[playerId]).sort((a: string, b: string) => Number(a) - Number(b));
                delete playerDiskStates[playerId][Number(sortedKeys[0])];
            }
            playerDiskStates[playerId][gameTick] = diskState;
        }
    },
    removeAuthority(playerId: string) {
        if (playerId == currentAuthorativePlayer) {
            currentAuthorativePlayer = "";
        }
    },

    changeDiskAuthority(gameTick: number, playerId: string) {
        authorityHistory[gameTick] = currentAuthorativePlayer;
        currentAuthorativePlayer = playerId;
        for (let tick: number = gameTick + 1; tick < lastDiskState; tick++) {
            if (diskStates.hasOwnProperty(tick)) {
                delete diskStates[tick];
            }
        }
        lastDiskState = gameTick;
    },

    getDiskStatesFrom(fromGameTick: number): {[gameTick:number] : DiskState} {
        const sortedKeys: string[] = Object.keys(diskStates).sort((a: string, b: string) => Number(a) - Number(b));
        let result: {[gameTick:number] : DiskState} = {};

        sortedKeys.forEach(gameTick => {
            if (Number(gameTick) >= fromGameTick) {
                result[Number(gameTick)] = diskStates[Number(gameTick)];
            }
        });

        return result;
    },

    getCurrentAuthority() {
        return currentAuthorativePlayer;
    },

    IsAuthority(playerId: string) {
        return currentAuthorativePlayer == playerId;
    }
}
