declare global {
  var physicsFrameRate: number;
  var gameTicksToKeep: number;
  var lastReceivedTick: number;
  var serverGameTime: number;
}

global.physicsFrameRate = 72;
global.gameTicksToKeep = 72;
global.lastReceivedTick = 0;
global.serverGameTime = 0;

import dgram from 'dgram';
import zlib from 'zlib';
import { server } from './server';
import { Buffer } from 'buffer';
import { playerInputs} from './playerInputs';
import { disk } from './disk';

const messageSegments: {[messageId: string]: {[seqNumber: number]: Buffer}} = {};
const socket = dgram.createSocket('udp4');

const noTimeouts = process.argv.includes('--noTimeouts');

const subscribers = new Map<string, {
    playerId: string;
    address: string;
    port: number;
    messagesReceived: number;
}>();

let totalSentBytes:number = 0;
let totalReceivedBytes:number = 0;
let startingTick:number = 0;

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
        const messageString = JSON.stringify(server.createServerMessage(subscriber.playerId));

        const compressedMessage = zlib.gzipSync(messageString, {level: 1});

        const messageLength = Buffer.alloc(4);
        messageLength.writeUInt32LE(messageString.length);
        const fullMessage = Buffer.concat([messageLength, compressedMessage]);

        socket.send(fullMessage, subscriber.port, subscriber.address);
        totalSentBytes+=fullMessage.length;
        //console.log(`Sent message ${messageString.length}:${compressedMessage.byteLength} to ${subscriber.address}:${subscriber.port}`);
    });
}, 1000 / physicsFrameRate);
  
if (!noTimeouts) {
    setInterval(() => {
        subscribers.forEach((subscriber, subscriberId) => {
        if (subscriber.messagesReceived == 0) {
            removeSubscriber(subscriberId, subscriber.address, subscriber.port);
            playerInputs.removePlayer(subscriber.playerId);
            disk.removeAuthority(subscriber.playerId);
            console.log(`Subscriber timed out:  ${subscriber.playerId} - ${subscriber.address}:${subscriber.port}`);
        } else {
            subscriber.messagesReceived = 0;
        }
        });
    }, 5000);
}
  
socket.on('message', (message: Buffer, rinfo: dgram.RemoteInfo) => {
    if (message.toString().startsWith('CONNECT')) {
      let playerId:string = message.toString().substring(7, message.length - 1);
      // match = matches.getMatchByPlayer(playerId);
      
      addSubscriber(playerId, rinfo.address, rinfo.port);
      return;
    }
    
    if (message.toString().startsWith('DISCONNECT')) {
      let playerId = message.toString().substring(10, message.length - 1);
      // match = matches.getMatchByPlayer(playerId);
      
      removeSubscriber(playerId, rinfo.address, rinfo.port);
      playerInputs.removePlayer(playerId);
      disk.removeAuthority(playerId);
      return;
    }
  
    totalReceivedBytes+=message.length;
  
    const subscriberId:string = rinfo.address+':'+rinfo.port;
  
    if (!subscribers.has(subscriberId)) {
      return;
    }
  
    const messageId:number = message.readInt32LE(0);
    const seqNum:number = message.readInt32LE(4);
    const totalSegments:number = message.readInt32LE(8);
  
    const msgPart = message.subarray(12);
  
    if (subscribers.get(subscriberId) !== undefined) {
      subscribers.get(subscriberId)!.messagesReceived++;
    }

    const messageKey:string = subscriberId.toString()+':'+messageId.toString();
  
    if(!messageSegments.hasOwnProperty(subscriberId+':'+messageId)) {
      messageSegments[messageKey] = {};
    }
    messageSegments[messageKey][seqNum] = msgPart;
  
    if (Object.keys(messageSegments[messageKey]).length === totalSegments) {
      let combinedMessage = Buffer.concat(
        Object.keys(messageSegments[messageKey])
        .sort((a: string,b: string) => parseInt(a) - parseInt(b))
        .map((key: string) => messageSegments[messageKey][parseInt(key)]));
  
      delete messageSegments[subscriberId+':'+messageId];
  
      deleteOldMessages(subscriberId, messageId)
  
      zlib.gunzip(combinedMessage, (err, uncompressedMsg) => {
        if (err) {
          console.error(err);
          return;
        }
  
        //console.log(`Received message: ${uncompressedMsg} from ${rinfo.address}:${rinfo.port}`);
  
        const data = JSON.parse(uncompressedMsg.toString());
        
        server.processMessage(data);
      });
    }
  });

  
socket.on('listening', () => {
    const address = socket.address();
    console.log(`Server listening on ${address.address}:${address.port}`);
  });
  
  socket.bind(1234);
  
  const deleteOldMessages = (subscriberId:string, lastMessageId:number) => {
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
  
  const addSubscriber = (playerId:string, address:string, port:number) => {
    let subscriberId = address+':'+port.toString();
  
    if (subscribers.has(subscriberId)) 
    {
      console.log('Subscriber already in list');
      return;
    }
  
    console.log(`New subscriber: ${playerId} - ${address}:${port}`);
    let messagesReceived = 1;
    subscribers.set(subscriberId, { playerId, address, port, messagesReceived });
  };
  
const removeSubscriber = (playerId: string, address: string, port: number) => {
    let subscriberId:string = address+':'+port.toString();

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