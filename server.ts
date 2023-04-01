import { disk, DiskState } from './disk';
import { playerInputs, PlayerState } from './playerInputs';

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
          estimatedAhead = 0;//Math.round((serverPing / 1000) * global.physicsFrameRate) / 2;
          console.log("Estimated ahead: " + Math.round((serverPing / 1000) * global.physicsFrameRate) / 2 + " (ping: " + serverPing + "ms)");
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
  },
  decodeFSonarPlayerState(buffer: Buffer): PlayerState {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
    const json: any = {};
  
    // Read PlayerId as FString
    const playerIdLen = view.getInt32(0, true);
    let offset = playerIdLen + 4;
    json.PlayerId = new TextDecoder().decode(buffer.subarray(4, offset));
  
    // Read bSimulated, PlayerPing and HeadPosition as is
    json.bSimulated = view.getUint8(offset) !== 0;
    offset += 1;
    json.PlayerPing = view.getInt32(offset, true);
    offset += 4;
    json.HeadPosition = this.decodeCompressedVector(view, offset);
    offset += 6;
  
    // Read HeadRotation, BodyPosition and BodyVelocity as compressed vectors
    offset = 29 + playerIdLen;
    json.HeadRotation = this.decodeCompressedVector(view, offset);
    offset += 6;
    json.BodyPosition = this.decodeCompressedVector(view, offset);
    offset += 6;
    json.BodyVelocity = this.decodeCompressedVector(view, offset);
    offset += 6;
    json.BodyRotation = this.decodeCompressedVector(view, offset);
    offset += 6;
  
    // Read LeftHandPosition and LeftHandRotation as compressed vectors
    json.LeftHandPosition = this.decodeCompressedVector(view, offset);
    offset += 6;
    json.LeftHandRotation = this.decodeCompressedVector(view, offset);
    offset += 6;
  
    // Read RightHandPosition and RightHandRotation as compressed vectors
    json.RightHandPosition = this.decodeCompressedVector(view, offset);
    offset += 6;
    json.RightHandRotation = this.decodeCompressedVector(view, offset);
    offset += 6;
  
    // Read compressed bools as a single byte
    const compressedBool = view.getUint8(offset);
    json.bLeftAutoGrap = (compressedBool & 0x01) !== 0;
    json.bRightAutoGrab = (compressedBool & 0x02) !== 0;
    json.bLeftBoosterActive = (compressedBool & 0x04) !== 0;
    json.bRightBoosterActive = (compressedBool & 0x08) !== 0;
    json.bBrakesActive = (compressedBool & 0x10) !== 0;
    json.bStunned = (compressedBool & 0x20) !== 0;
  
    // Read StunTime as a float
    json.StunTime = view.getFloat32(offset + 1, true);
  
    const playerState: PlayerState = json as PlayerState;

    return playerState;
  },
  
  decodeCompressedVector(view: DataView, offset: number) {
    const compressedX = view.getInt16(offset, true);
    const compressedY = view.getInt16(offset + 2, true);
    const compressedZ = view.getInt16(offset + 4, true);
    const range = 32767.0;
    const vector = {
      X: compressedX / range,
      Y: compressedY / range,
      Z: compressedZ / range,
    };
    return vector;
  }
}