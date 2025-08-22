

import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import Ombede from './Ombede.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

const obd = new Ombede();

app.use(express.static('public'));

function startStream() {
  setInterval(() => {
    const data = obd.request(['RPM', 'SPEED', 'ETHANOL_PERCENT', 'FUEL_LEVEL', 'FUEL_FLOW', 'GEAR', 'FUEL_EFFICIENCY']);
    io.emit('obd-data', data);
  }, 100);
}

io.on('connection', (socket) => {
  console.log('Frontend connected');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  startStream();
});