import { disk, DiskState } from './disk';
import { playerInputs} from './playerInputs';

let targetDeltaTime: number = 1 / global.physicsFrameRate;
const MAX_DELTA_TIME_DEVIATION = 0.1;

interface GameState {
    gameTimeTick: string;
    playerStates: {
      [playerId: string]: any;
    };
    diskState: any;
    deltaTime: number;
}

interface ClientMessage {
    source: string;
    serverTime: number;
    clientTime: number;
    lastReceivedTick: number;
    gameTimeTick: number;
    gameStatesHistory: GameState[];
}

interface ServerGameState {
    GameTimeTick: string;
    PlayersStates: {
      [playerId: string]: any;
    };
    DiskState: any;
}

interface ServerMessage {
    ServerTime: number;
    ClientTime: number;
    EstimatedGameTick: number;
    bIsAuthority: boolean;
    GameStatesHistory: ServerGameState[];
}

export const server = {
    processMessage(data: ClientMessage) {
        let playerId = data.source;
    
        let hrTime = process.hrtime.bigint();
        let serverTime = Number(hrTime / BigInt(1000000));
    
        let serverPing = serverTime - Number(data.serverTime);
        let serverLastReceivedTick: number = data.gameTimeTick;
    
        let estimatedAhead = (serverLastReceivedTick - data.lastReceivedTick) / 2;
        if (data.lastReceivedTick == 0) {
        estimatedAhead = Math.round((serverPing / 1000) * global.physicsFrameRate) / 2;
        }
    
        data.gameStatesHistory.forEach(gameState => {
        if (Math.abs(gameState.deltaTime - targetDeltaTime) < targetDeltaTime * MAX_DELTA_TIME_DEVIATION) {
            disk.addDiskState(playerId, Number(gameState.gameTimeTick), gameState.diskState);
    
            Object.keys(gameState.playerStates).forEach(pid => {
            let playerState = gameState.playerStates[pid];
            if (playerId == pid) {
                playerState.playerPing = serverPing;
                playerInputs.addPlayerState(pid, Number(gameState.gameTimeTick), playerState);
            }
            });
        } else {
            console.log('Discarding game state ' + gameState.gameTimeTick + ' with deltaTime: ' + gameState.deltaTime + ' (target: ' + targetDeltaTime + ') - Source: ' + data.source);
        }
        });
    
        if (global.lastReceivedTick < serverLastReceivedTick) {
            global.lastReceivedTick = serverLastReceivedTick;
        }
    
        playerInputs.setPlayerLastInputGameTick(playerId, data.lastReceivedTick);
        playerInputs.setPlayerLastClientTime(playerId, data.clientTime, serverTime, serverPing, estimatedAhead);
    },

  createServerMessage (playerId: string): ServerMessage {
    let hrTime = process.hrtime.bigint();
    let serverTime = Number(hrTime / BigInt(1000000));
    let gameTicksFrom = playerInputs.getPlayerLastInputGameTick(playerId);
    
    const diskStates:{[gameTick:number] : DiskState} = disk.getDiskStatesFrom(gameTicksFrom);
    const serverPlayersStates = playerInputs.getPlayerStatesFrom(gameTicksFrom);
  
    let gameStatesHistory: ServerGameState[] = [];
  
    for (const gameTick in diskStates) {
      if (!Object.hasOwnProperty.call(diskStates, gameTick)) {
        continue;
      }
  
      const diskState = diskStates[gameTick];
  
      let playerStates: any = {};
      
      if (serverPlayersStates.hasOwnProperty(gameTick)) {
        for (const playerId in serverPlayersStates[gameTick]) {
          if (Object.hasOwnProperty.call(serverPlayersStates[gameTick], playerId)) {
            const playerState = serverPlayersStates[gameTick][playerId];
            
            playerStates[playerId] = playerState;
          }
        }
      }
      
      let gameState: ServerGameState = {
          "GameTimeTick": gameTick,
          "PlayersStates": playerStates,
          "DiskState": diskState
        };
  
      gameStatesHistory.push(gameState);
    }
  
    let estimatedGameTime = global.serverGameTime + playerInputs.getEstimatedTicksAhead(playerId);
  
    let serverMessage: ServerMessage = {
        "ServerTime": serverTime,
        "ClientTime": playerInputs.getPlayerLastClientTime(playerId, serverTime),
        "EstimatedGameTick": estimatedGameTime,
        "bIsAuthority": disk.IsAuthority(playerId),
        "GameStatesHistory": gameStatesHistory
    };

    return serverMessage;
  }
}