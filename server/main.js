import { Connection } from "./cannect.js";
import { KaCalculator } from "./calculator.js";
import { WebSocketServer } from 'ws';
import fs from 'fs';

// WebSocket server setup
const server = new WebSocketServer({ port: 3002 });
console.log('WebSocket server listening on port 3002');

function broadcast(data) {
    const message = JSON.stringify(data);
    server.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}

const baseLogFile = `./can-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
let logFile = baseLogFile;
let count = 1;
while (fs.existsSync(logFile)) {
    const extIndex = baseLogFile.lastIndexOf('.');
    if (extIndex !== -1) {
        logFile = `${baseName.slice(0, extIndex)}_${count}${baseName.slice(extIndex)}`;
    } else {
        logFile = `${baseName}_${count}`;
    }
    count++;
}

const connection = new Connection({
    host: 'localhost',
    parser: './can/ford_ka.json',
    signals: ['rpm', 'speed', 'batteryCharge', 'fuelLevel', 'fuelConsumption', 'odometer', 'steeringAngle'],
    calculator: new KaCalculator(),
    debug: false,
    logFile: logFile
});

connection.connect();

// Buffer data and send through websocket periodically
let dataBuffer = [];

connection.onCalculatedData((data) => {
    dataBuffer.push(data);
});

setInterval(() => {
    if (dataBuffer.length > 0) {
        broadcast({ type: 'canData', payload: dataBuffer });
        // console.log(dataBuffer.at(-1));
        dataBuffer = [];
    }
}, 500);