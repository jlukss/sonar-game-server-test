const dgram = require('dgram');
const zlib = require('node:zlib');
const server = dgram.createSocket('udp4');
// const matches = require('./matches.js');
const disk = require('./disk.js');
const playerInputs = require('./playerInputs.js');

const subscribers = [];

global.physicsFrameRate = 72;
global.gameTicksToKeep = 120;
let totalSentBytes = 0;

setInterval(() => {
  const bytesPerSecond = totalSentBytes;
  totalSentBytes = 0;
  const mbps = bytesPerSecond * 8 / 1000000;
  process.stdout.write(`Sent ${bytesPerSecond} bytes/s (${mbps.toFixed(2)} Mbps)   \r`);
}, 1000);

setInterval(() => {
  subscribers.forEach((subscriber) => {
    const messageString = JSON.stringify(createServerMessage(subscriber.playerId));
  
    const compressedMessage = zlib.gzipSync(messageString, {level: 1});

    const messageLength = Buffer.alloc(4);
    messageLength.writeUInt32LE(messageString.length);
    const fullMessage = Buffer.concat([messageLength, compressedMessage]);

    server.send(fullMessage, subscriber.port, subscriber.address);
    totalSentBytes+=fullMessage.length;
    //console.log(`Sent message ${messageString.length}:${compressedMessage.byteLength} to ${subscriber.address}:${subscriber.port}`);
  });
}, 1000 / global.physicsFrameRate);


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
  for (let i = 0; i < subscribers.length; i++) {
    if (
        (subscribers[i].playerId === playerId) && 
        (subscribers[i].address === address) && 
        (subscribers[i].port === port)
      ) 
      {
        console.log('Subscriber already in list');
        return;
      }
    }
  console.log(`New subscriber: ${playerId} - ${address}:${port}`);
  subscribers.push({ playerId, address, port });
};

const removeSubscriber = (playerId, address, port) => {
  for (let i = 0; i < subscribers.length; i++) {
    if (
        (subscribers[i].playerId === playerId) && 
        (subscribers[i].address === address) && 
        (subscribers[i].port === port)
      ) 
      {
      subscribers.splice(i, 1);
      console.log(`Subscriber disconnected:  ${playerId} - ${address}:${port}`);
      return;
    }
  }
  console.log(`Subscriber with: ${playerId} - ${address}:${port} not found`);
}

const processMessage = (data) => {
  let hrTime = process.hrtime.bigint();
  let serverTime = Number(hrTime / BigInt(1000000));

  let serverPing = serverTime - Number(data.serverTime);

  data.gameStatesHistory.forEach(gameState => {
    Object.keys(gameState.playerStates).forEach(playerId => {
      playerInputs.setPlayerLastClientTime(playerId, data.clientTime, serverTime);

      disk.addDiskState(playerId, gameState.gameTimeTick, gameState.diskState);

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
