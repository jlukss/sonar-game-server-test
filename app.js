const dgram = require('dgram');
const zlib = require('node:zlib');
const server = dgram.createSocket('udp4');
// const matches = require('./matches.js');
const disk = require('./disk.js');
const playerInputs = require('./playerInputs.js');

const subscribers = new Map();

global.physicsFrameRate = 72;
global.gameTicksToKeep = 120;
let totalSentBytes = 0;
let totalReceivedBytes = 0;

setInterval(() => {
  const bytesPerSecondSent = totalSentBytes;
  const bytesPerSecondReceived = totalReceivedBytes;
  totalSentBytes = 0;
  totalReceivedBytes = 0;
  const mbpsSent = bytesPerSecondSent * 8 / 1000000;
  const mbpsRecv = bytesPerSecondReceived * 8 / 1000000;
  process.stdout.write(`Sent ${bytesPerSecondSent} bytes/s (${mbpsSent.toFixed(2)} Mbps). Received ${bytesPerSecondReceived} bytes/s (${mbpsRecv.toFixed(2)} Mbps)  \r`);
}, 1000);

setInterval(() => {
  subscribers.forEach((subscriber, playerId) => {
    const messageString = JSON.stringify(createServerMessage(playerId));
  
    const compressedMessage = zlib.gzipSync(messageString, {level: 1});

    const messageLength = Buffer.alloc(4);
    messageLength.writeUInt32LE(messageString.length);
    const fullMessage = Buffer.concat([messageLength, compressedMessage]);

    server.send(fullMessage, subscriber.port, subscriber.address);
    totalSentBytes+=fullMessage.length;
    //console.log(`Sent message ${messageString.length}:${compressedMessage.byteLength} to ${subscriber.address}:${subscriber.port}`);
  });
}, 1000 / global.physicsFrameRate);


setInterval(() => {
  subscribers.forEach((subscriber, playerId) => {
    if (subscriber.messgesReceived == 0) {
      removeSubscriber(playerId, subscriber.address, subscriber.port);
      playerInputs.removePlayer(playerId);
      console.log(`Subscriber timed out:  ${playerId} - ${subscriber.address}:${subscriber.port}`);
    } else {
      subscriber.messgesReceived = 0;
    }
  });
}, 5000);

server.on('message', (message, rinfo) => {
  if (message.toString().startsWith('CONNECT')) {
    playerId = message.toString().substring(7, message.length - 1);
    // match = matches.getMatchByPlayer(playerId);
    
    addSubscriber(playerId, rinfo.address, rinfo.port);
  } else if (message.toString().startsWith('DISCONNECT')) {
    playerId = message.toString().substring(10, message.length - 1);
    // match = matches.getMatchByPlayer(playerId);
    
    removeSubscriber(playerId, rinfo.address, rinfo.port);
    playerInputs.removePlayer(playerId);
  } else {  
    totalReceivedBytes+=message.length;

    zlib.gunzip(message, (err, uncompressedMsg) => {
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

server.on('listening', () => {
  const address = server.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});

server.bind(1234);

// Function to add a subscriber to the list of subscribers
const addSubscriber = (playerId, address, port) => {
  if (subscribers.has(playerId)) 
  {
    console.log('Subscriber already in list');
    return;
  }

  console.log(`New subscriber: ${playerId} - ${address}:${port}`);
  messgesReceived = 1;
  subscribers.set(playerId, { address, port, messgesReceived });
};

const removeSubscriber = (playerId, address, port) => {
  if (subscribers.has(playerId)) 
  {
    subscribers.delete(playerId);
    console.log(`Subscriber disconnected:  ${playerId} - ${address}:${port}`);
    return;
  }
  console.log(`Subscriber with: ${playerId} - ${address}:${port} not found`);
}

const processMessage = (data) => {
  if (!subscribers.has(playerId)) {
    return;
  }

  subscribers.get(playerId).messgesReceived++;

  let hrTime = process.hrtime.bigint();
  let serverTime = Number(hrTime / BigInt(1000000));

  let serverPing = serverTime - Number(data.serverTime);
  let playerId = data.source;

  playerInputs.setPlayerLastClientTime(playerId, data.clientTime, serverTime);

  data.gameStatesHistory.forEach(gameState => {
    disk.addDiskState(playerId, gameState.gameTimeTick, gameState.diskState);

    Object.keys(gameState.playerStates).forEach(playerId => {
      let playerState = gameState.playerStates[playerId];
      playerState.playerPing = serverPing;
      playerInputs.addPlayerState(playerId, gameState.gameTimeTick, playerState);
    });
  });
}

const createServerMessage = (playerId) => {
  let hrTime = process.hrtime.bigint();
  let serverTime = Number(hrTime / BigInt(1000000));
  let gameTicksFrom = playerInputs.getPlayerLastInputGameTick(playerId);
  
  const diskStates = disk.getDiskStatesFrom(gameTicksFrom);
  const serverPlayersStates = playerInputs.getPlayerStatesFrom(gameTicksFrom);

  let gameStatesHistory = [];

  for (const gameTick in diskStates) {
    if (Object.hasOwnProperty.call(diskStates, gameTick)) {
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
  }

  return {
    "ServerTime": serverTime,
    "ClientTime": playerInputs.getPlayerLastClientTime(playerId, serverTime),
    "GameStatesHistory": gameStatesHistory
  };
}
