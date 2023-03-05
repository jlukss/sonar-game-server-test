const dgram = require('dgram');
const zlib = require('node:zlib');
const server = dgram.createSocket('udp4');
// const matches = require('./matches.js');
const disk = require('./disk.js');
const playerInputs = require('./playerInputs.js');

const subscribers = [];

global.physicsFrameRate = 72;
global.gameTicksToKeep = 120;


setInterval(() => {
  subscribers.forEach((subscriber) => {
    const messageString = JSON.stringify(createServerMessage(subscriber.playerId));
  
    const compressedMessage = zlib.gzipSync(messageString);

    server.send(compressedMessage, subscriber.port, subscriber.address);
    console.log(`Sent message to ${subscriber.address}:${subscriber.port}`);
  });
}, 1000 / global.physicsFrameRate);


server.on('message', (message, rinfo) => {

  if (message.toString().startsWith('CONNECT')) {
    playerId = message.toString().substring(7);
    // match = matches.getMatchByPlayer(playerId);
    
    addSubscriber(playerId, rinfo.address, rinfo.port);
  } else if (message.toString().startsWith('DISCONNECT')) {
    playerId = message.toString().substring(7);
    // match = matches.getMatchByPlayer(playerId);
    
    removeSubscriber(playerId, rinfo.address, rinfo.port);
  } else {  
    zlib.gunzip(message, (err, uncompressedMsg) => {
      if (err) {
        console.error(err);
        return;
      }

      console.log(`Received message: ${uncompressedMsg} from ${rinfo.address}:${rinfo.port}`);

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
  console.log(`Subscriber with: ${address}:${port} not found`);
}

const processMessage = (data) => {
  let hrTime = process.hrtime.bigint();
  let serverTime = hrTime / 1000;

  let serverPing = serverTime - data.serverTime;

  data.gameStatesHistory.forEach(gameState => {
    gameState.playerStates.keys().forEach(playerId => {
      playerInputs.setPlayerLastClientTime(playerId, data.clientTime);

      disk.addDiskState(playerId, gameState.gameTimeTick, gameState.diskState);

      let playerState = gameState.playerStates[playerId];
      playerState.playerPing = serverPing;
      playerInputs.addPlayerState(playerId, gameState.gameTimeTick, playerState);
    });
  });
}

const createServerMessage = (playerId) => {
  let hrTime = process.hrtime.bigint();
  let serverTime = hrTime / 1000;
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
          "gameTimeTick": gameTick,
          "playerStates": playerStates,
          "diskState": diskState
        };

      gameStatesHistory.push(gameState);
    }
  }

  return {
    "serverTime": serverTime,
    "clientTime": playerInputs.getPlayerLastClientTime(playerId),
    "gameStatesHistory": gameStatesHistory
  };
}
