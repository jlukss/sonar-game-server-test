const dgram = require('dgram');
const server = dgram.createSocket('udp4');
// const matches = require('./matches.js');

const subscribers = [];

server.on('message', (message, rinfo) => {
  // console.log(`Received message: ${message} from ${rinfo.address}:${rinfo.port}`);

  if (message.toString().startsWith('CONNECT')) {
    // playerId = message.toString().substring(7);
    // match = matches.getMatchByPlayer(playerId);
    
    addSubscriber(rinfo.address, rinfo.port);
  } else {
    // Broadcast the message to all subscribers except the sender
    subscribers.forEach((subscriber) => {
      //if (subscriber.address !== rinfo.address || subscriber.port !== rinfo.port) {
        server.send(message, subscriber.port, subscriber.address);
        console.log(`Sent message: ${message} to ${subscriber.address}:${subscriber.port}`);
    //  }
    });
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});

server.bind(1234);

// Function to add a subscriber to the list of subscribers
const addSubscriber = (address, port) => {
  console.log(`New subscriber: ${address}:${port}`);
  subscribers.push({ address, port });
};
