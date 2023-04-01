const MAX_PING_MEASUREMENTS = 10;

export interface PlayerState {
    PlayerId: string;
    bSimulated: boolean;
    PlayerPing: number;
    HeadPosition: { X: number, Y: number, Z: number };
    HeadRotation: { X: number, Y: number, Z: number };
    BodyPosition: { X: number, Y: number, Z: number };
    BodyVelocity: { X: number, Y: number, Z: number };
    BodyRotation: { X: number, Y: number, Z: number };
    LeftHandPosition: { X: number, Y: number, Z: number };
    LeftHandRotation: { X: number, Y: number, Z: number };
    RightHandPosition: { X: number, Y: number, Z: number };
    RightHandRotation: { X: number, Y: number, Z: number };
    bLeftAutoGrap: boolean;
    bRightAutoGrab: boolean;
    bLeftBoosterActive: boolean;
    bRightBoosterActive: boolean;
    bBrakesActive: boolean;
    bStunned: boolean;
    StunTime: number;
}

type PlayerInputsHistory = { [playerId: string]: { [gameTick: number]: any } };
type LastClientTime = { [playerId: string]: [number, number] };
type TicksOffsetHistory = { [playerId: string]: number[] };
type ClientPingsHistory = { [playerId: string]: number[] };
type LastReceivedTick = { [playerId: string]: number };
type LastPlayerInput = { [playerId: string]: number };

let playerInputsHistory: PlayerInputsHistory = {};
let lastClientTime: LastClientTime = {};
let ticksOffsetHistory: TicksOffsetHistory = {};
let clientPingsHistory: ClientPingsHistory = {};
let playerLastReceivedTick: LastReceivedTick = {};
let lastPlayerInput: LastPlayerInput = {};

export const playerInputs = {
    reset() {
        playerInputsHistory = {};
        lastClientTime = {};
        ticksOffsetHistory = {};
        clientPingsHistory = {};
        playerLastReceivedTick = {};
        lastPlayerInput = {};

        console.log('Player inputs reset');
    },

    addPlayerState(playerId: string, gameTick: number, state: any) {
        if(!playerInputsHistory.hasOwnProperty(playerId))
        {
            playerInputsHistory[playerId] = {
                [gameTick]: state
            }

            lastPlayerInput[playerId] = gameTick;

            return;
        }

        if (playerInputsHistory[playerId].hasOwnProperty(gameTick)) {
            return;
        }

        playerInputsHistory[playerId][gameTick] = state;

        if (Object.keys(playerInputsHistory[playerId]).length == global.gameTicksToKeep) 
        {
            const sortedKeys = Object.keys(playerInputsHistory[playerId]).sort((a: string, b: string) => Number(a) - Number(b));
            delete playerInputsHistory[playerId][Number(sortedKeys[0])];
        }

        if (lastPlayerInput[playerId] < gameTick) {
            lastPlayerInput[playerId] = gameTick;
        }
    },

    setPlayerLastInputGameTick(playerId: string, gameTick: number) {    
        if (!playerLastReceivedTick.hasOwnProperty(playerId)) {
            playerLastReceivedTick[playerId] = gameTick;

            return;
        }

        if (playerLastReceivedTick[playerId] < gameTick) {
            playerLastReceivedTick[playerId] = gameTick;
        }
    },

    getPlayerLastInputGameTick(playerId: string) {
        if(!playerLastReceivedTick.hasOwnProperty(playerId)) {
            return 0
        }

        let latestInput = playerLastReceivedTick[playerId];

        Object.keys(lastPlayerInput).forEach(pid => {
            let gameTick = lastPlayerInput[pid];
            if (pid !== playerId && gameTick < latestInput) {
                latestInput = gameTick;
            }
        });

        return latestInput;
    },

    getPlayerStatesFrom(fromGameTick: number): {[gameTick: number]: any} {
        let result: {[gameTick: number]: any} = {};

        for (const playerId in playerInputsHistory) {
            for (const gameTick in playerInputsHistory[playerId]) {
                if ((Number(gameTick) >= fromGameTick) && (Object.hasOwnProperty.call(playerInputsHistory[playerId], gameTick))) {
                    const state = playerInputsHistory[playerId][gameTick];
                    if (!result.hasOwnProperty(gameTick)) {
                        result[Number(gameTick)] = {
                            [playerId]: state
                        }
                    } else {
                        result[Number(gameTick)][playerId] = state;
                    }
                }
            }
        }

        return result;
    },

    setPlayerLastClientTime(playerId: string, clientTime: number, messageTime: number, clientPing: number, ticksAhead: number) {
        if (!lastClientTime.hasOwnProperty(playerId) || lastClientTime[playerId][0] < clientTime) {
            lastClientTime[playerId] = [clientTime, messageTime];
        }

        if (!clientPingsHistory.hasOwnProperty(playerId)) {
            clientPingsHistory[playerId] = [clientPing];
            ticksOffsetHistory[playerId] = [ticksAhead];
        } else {
            clientPingsHistory[playerId].push(clientPing);
            ticksOffsetHistory[playerId].push(ticksAhead);
        }
        if (clientPingsHistory[playerId].length > MAX_PING_MEASUREMENTS) {
            clientPingsHistory[playerId].shift();
            ticksOffsetHistory[playerId].shift();
        }
    },

    getPlayerLastClientTime(playerId: string, serverTime: number) {
        if (lastClientTime.hasOwnProperty(playerId)) {
            let clientTime = lastClientTime[playerId][0];
            let timeInBuffer = serverTime - lastClientTime[playerId][1];
            return clientTime + timeInBuffer;
        }

        return 0;
    },

    getEstimatedTicksAhead(playerId: string) {
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
    },

    removePlayer(playerId: string) {
        if (playerInputsHistory.hasOwnProperty(playerId)) {
            delete playerInputsHistory[playerId];
        }

        if (lastClientTime.hasOwnProperty(playerId)) {
            delete lastClientTime[playerId];
        }

        if (playerLastReceivedTick.hasOwnProperty(playerId)) {
            delete playerLastReceivedTick[playerId];
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
}