import { Connection } from "./cannect.js";
import { KaCalculator } from "./calculator.js";
import { WebSocketServer } from 'ws';

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

const connection = new Connection({
    host: 'localhost',
    parser: './can/ford_ka.json',
    signals: ['rpm', 'speed', 'batteryCharge', 'fuelLevel', 'fuelConsumption', 'odometer', 'steeringAngle'],
    calculator: new KaCalculator(),
    debug: false,
    logFile: './can.log'
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