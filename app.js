const dgram = require('dgram');
const zlib = require('node:zlib');
const socket = dgram.createSocket('udp4');
// const matches = require('./matches.js');
const disk = require('./disk.js');
const playerInputs = require('./playerInputs.js');

const subscribers = new Map();
const messageSegments = {};

global.physicsFrameRate = 72;
global.gameTicksToKeep = 72;
let totalSentBytes = 0;
let totalReceivedBytes = 0;
let lastReceivedTick = 0;
let startingTick = 0;
let serverGameTime = 0;

let targetDeltaTime = 1 / global.physicsFrameRate;
const MAX_DELTA_TIME_DEVIATION = 0.1;

const noTimeouts = process.argv.includes('--noTimeouts');

setInterval(() => {
  const bytesPerSecondSent = totalSentBytes;
  const bytesPerSecondReceived = totalReceivedBytes;
  const ticksPerSecond = lastReceivedTick - startingTick;
  totalSentBytes = 0;
  totalReceivedBytes = 0;
  startingTick = lastReceivedTick;
  const mbpsSent = bytesPerSecondSent * 8 / 1000000;
  const mbpsRecv = bytesPerSecondReceived * 8 / 1000000;
  const currentAuthorativePlayer = disk.getCurrentAuthority();

  process.stdout.write(`Sent ${bytesPerSecondSent} bytes/s (${mbpsSent.toFixed(2)} Mbps). Received ${bytesPerSecondReceived} bytes/s (${mbpsRecv.toFixed(2)} Mbps). Last Received Tick - ${lastReceivedTick}/${serverGameTime} (${ticksPerSecond} tps) (${currentAuthorativePlayer})\r`);
}, 1000);

setInterval(() => {
  if (subscribers.size > 0) {
    serverGameTime++;
  }

  subscribers.forEach((subscriber, subscriberId) => {
    const messageString = JSON.stringify(createServerMessage(subscriber.playerId));
  
    const compressedMessage = zlib.gzipSync(messageString, {level: 1});

    const messageLength = Buffer.alloc(4);
    messageLength.writeUInt32LE(messageString.length);
    const fullMessage = Buffer.concat([messageLength, compressedMessage]);

    socket.send(fullMessage, subscriber.port, subscriber.address);
    totalSentBytes+=fullMessage.length;
    //console.log(`Sent message ${messageString.length}:${compressedMessage.byteLength} to ${subscriber.address}:${subscriber.port}`);
  });
}, 1000 / global.physicsFrameRate);

if (!noTimeouts) {
  setInterval(() => {
    subscribers.forEach((subscriber, subscriberId) => {
      if (subscriber.messagesReceived == 0) {
        removeSubscriber(subscriberId, subscriber.address, subscriber.port);
        playerInputs.removePlayer(subscriber.playerId);
        disk.removeAuthority(playerId);
        console.log(`Subscriber timed out:  ${subscriber.playerId} - ${subscriber.address}:${subscriber.port}`);
      } else {
        subscriber.messagesReceived = 0;
      }
    });
  }, 5000);
}

socket.on('message', (message, rinfo) => {
  if (message.toString().startsWith('CONNECT')) {
    playerId = message.toString().substring(7, message.length - 1);
    // match = matches.getMatchByPlayer(playerId);
    
    addSubscriber(playerId, rinfo.address, rinfo.port);
    return;
  }
  
  if (message.toString().startsWith('DISCONNECT')) {
    playerId = message.toString().substring(10, message.length - 1);
    // match = matches.getMatchByPlayer(playerId);
    
    removeSubscriber(playerId, rinfo.address, rinfo.port);
    playerInputs.removePlayer(playerId);
    disk.removeAuthority(playerId);
    return;
  }

  totalReceivedBytes+=message.length;

  const subscriberId = rinfo.address+':'+rinfo.port;

  if (!subscribers.has(subscriberId)) {
    return;
  }

  const messageId = message.readInt32LE(0);
  const seqNum = message.readInt32LE(4);
  const totalSegments = message.readInt32LE(8);

  const msgPart = message.subarray(12);

  subscribers.get(subscriberId).messagesReceived++;

  if(!messageSegments.hasOwnProperty(subscriberId+':'+messageId)) {
    messageSegments[subscriberId+':'+messageId] = {};
  }
  messageSegments[subscriberId+':'+messageId][seqNum] = msgPart;

  if (Object.keys(messageSegments[subscriberId+':'+messageId]).length === totalSegments) {
    let combinedMessage = Buffer.concat(
      Object.keys(messageSegments[subscriberId+':'+messageId])
      .sort((a,b) => parseInt(a) - parseInt(b))
      .map(key => messageSegments[subscriberId+':'+messageId][key]));

    delete messageSegments[subscriberId+':'+messageId];

    deleteOldMessages(subscriberId, messageId)

    zlib.gunzip(combinedMessage, (err, uncompressedMsg) => {
      if (err) {
        console.error(err);
        return;
      }

      //console.log(`Received message: ${uncompressedMsg} from ${rinfo.address}:${rinfo.port}`);

      const data = JSON.parse(uncompressedMsg);
      
      processMessage(data);
    });
  }
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});

socket.bind(1234);

const deleteOldMessages = (subscriberId, lastMessageId) => {
  Object.keys(messageSegments).filter((key) => {
    let parts = key.split(':');
    if (((parts[0]+':'+parts[1]) == subscriberId) && (parseInt(parts[2]) < lastMessageId)) {
      return true;
    }
    return false;
  }).forEach((key) => {
    delete messageSegments[key];
  });
}


// Function to add a subscriber to the list of subscribers
const addSubscriber = (playerId, address, port) => {
  let subscriberId = address+':'+port;

  if (subscribers.has(subscriberId)) 
  {
    console.log('Subscriber already in list');
    return;
  }

  console.log(`New subscriber: ${playerId} - ${address}:${port}`);
  messagesReceived = 1;
  subscribers.set(subscriberId, { playerId, address, port, messagesReceived });
};

const removeSubscriber = (playerId, address, port) => {
  let subscriberId = address+':'+port;
  if (subscribers.has(subscriberId)) 
  {
    subscribers.delete(subscriberId);
    console.log(`Subscriber disconnected:  ${playerId} - ${address}:${port}`);

    if (subscribers.size == 0) {
      serverGameTime = 0;

      disk.reset();
      playerInputs.reset();
    }

    return;
  }
  console.log(`Subscriber with: ${playerId} - ${address}:${port} not found`);
}

const processMessage = (data) => {
  let playerId = data.source;

  let hrTime = process.hrtime.bigint();
  let serverTime = Number(hrTime / BigInt(1000000));

  let serverPing = serverTime - Number(data.serverTime);
  let serverLastReceivedTick = parseInt(data.gameTimeTick);

  let estimatedAhead = (serverLastReceivedTick - parseInt(data.lastReceivedTick)) / 2;
  if (parseInt(data.lastReceivedTick) == 0) {
    estimatedAhead = Math.round((serverPing / 1000) * global.physicsFrameRate) / 2;
  }

  data.gameStatesHistory.forEach(gameState => {
    if (Math.abs(parseFloat(gameState.deltaTime) - targetDeltaTime) < targetDeltaTime * MAX_DELTA_TIME_DEVIATION) {
      disk.addDiskState(playerId, gameState.gameTimeTick, gameState.diskState);

      Object.keys(gameState.playerStates).forEach(playerId => {
        let playerState = gameState.playerStates[playerId];
        playerState.playerPing = serverPing;
        if (!playerState.bSimulated) {
          playerInputs.addPlayerState(playerId, gameState.gameTimeTick, playerState);
        }
      });
    } else {
      console.log('Discarding game state ' + gameState.gameTimeTick + ' with deltaTime: ' + parseFloat(gameState.deltaTime) + ' (target: ' + targetDeltaTime + ') - Source: ' + data.source);
    }
  });

  if (lastReceivedTick < serverLastReceivedTick) {
    lastReceivedTick = serverLastReceivedTick;
  }

  playerInputs.setPlayerLastInputGameTick(playerId, parseInt(data.lastReceivedTick));
  playerInputs.setPlayerLastClientTime(playerId, data.clientTime, serverTime, serverPing, estimatedAhead);
}

const createServerMessage = (playerId) => {
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

  let estimatedGameTime = serverGameTime + playerInputs.getEstimatedTicksAhead(playerId);

  return {
    "ServerTime": serverTime,
    "ClientTime": playerInputs.getPlayerLastClientTime(playerId, serverTime),
    "EstimatedGameTick": estimatedGameTime,
    "GameStatesHistory": gameStatesHistory
  };
}
