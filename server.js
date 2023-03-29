"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const disk = require('./disk.ts');
const playerInputs = require('./playerInputs.js');
let targetDeltaTime = 1 / physicsFrameRate;
const MAX_DELTA_TIME_DEVIATION = 0.1;
exports.server = {
    processMessage(data) {
        let playerId = data.source;
        let hrTime = process.hrtime.bigint();
        let serverTime = Number(hrTime / BigInt(1000000));
        let serverPing = serverTime - Number(data.serverTime);
        let serverLastReceivedTick = data.gameTimeTick;
        let estimatedAhead = (serverLastReceivedTick - data.lastReceivedTick) / 2;
        if (data.lastReceivedTick == 0) {
            estimatedAhead = Math.round((serverPing / 1000) * global.physicsFrameRate) / 2;
        }
        data.gameStatesHistory.forEach(gameState => {
            if (Math.abs(gameState.deltaTime - targetDeltaTime) < targetDeltaTime * MAX_DELTA_TIME_DEVIATION) {
                disk.addDiskState(playerId, gameState.gameTimeTick, gameState.diskState);
                Object.keys(gameState.playerStates).forEach(pid => {
                    let playerState = gameState.playerStates[pid];
                    if (playerId == pid) {
                        playerState.playerPing = serverPing;
                        playerInputs.addPlayerState(pid, gameState.gameTimeTick, playerState);
                    }
                });
            }
            else {
                console.log('Discarding game state ' + gameState.gameTimeTick + ' with deltaTime: ' + gameState.deltaTime + ' (target: ' + targetDeltaTime + ') - Source: ' + data.source);
            }
        });
        if (lastReceivedTick < serverLastReceivedTick) {
            lastReceivedTick = serverLastReceivedTick;
        }
        playerInputs.setPlayerLastInputGameTick(playerId, data.lastReceivedTick);
        playerInputs.setPlayerLastClientTime(playerId, data.clientTime, serverTime, serverPing, estimatedAhead);
    },
    createServerMessage(playerId) {
        let hrTime = process.hrtime.bigint();
        let serverTime = Number(hrTime / BigInt(1000000));
        let gameTicksFrom = playerInputs.getPlayerLastInputGameTick(playerId);
        const diskStates = disk.getDiskStatesFrom(gameTicksFrom);
        const serverPlayersStates = playerInputs.getPlayerStatesFrom(gameTicksFrom);
        let gameStatesHistory = [];
        for (const gameTick in diskStates) {
            if (!Object.hasOwnProperty.call(diskStates, gameTick)) {
                continue;
            }
            const diskState = diskStates[gameTick];
            let playerStates = {};
            if (serverPlayersStates.hasOwnProperty(gameTick)) {
                for (const playerId in serverPlayersStates[gameTick]) {
                    if (Object.hasOwnProperty.call(serverPlayersStates[gameTick], playerId)) {
                        const playerState = serverPlayersStates[gameTick][playerId];
                        playerStates[playerId] = playerState;
                    }
                }
            }
            let gameState = {
                "GameTimeTick": gameTick,
                "PlayersStates": playerStates,
                "DiskState": diskState
            };
            gameStatesHistory.push(gameState);
        }
        let estimatedGameTime = global.serverGameTime + playerInputs.getEstimatedTicksAhead(playerId);
        let serverMessage = {
            "ServerTime": serverTime,
            "ClientTime": playerInputs.getPlayerLastClientTime(playerId, serverTime),
            "EstimatedGameTick": estimatedGameTime,
            "bIsAuthority": disk.IsAuthority(playerId),
            "GameStatesHistory": gameStatesHistory
        };
        return serverMessage;
    }
};
