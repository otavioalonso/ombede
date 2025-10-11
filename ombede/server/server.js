


const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const Ombede = require('./Ombede.js');
// import SerialPort from 'serialport';
// import Readline from '@serialport/parser-readline';

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});


// // Define connection object for OBD interface
// const portName = '/dev/ttyUSB0'; // Change to your OBD device path
// const serialOptions = { baudRate: 9600, autoOpen: true };
// const serialPort = new SerialPort(portName, serialOptions);
// const parser = serialPort.pipe(new Readline({ delimiter: '\r\n' }));

// const connection = {
//   port: serialPort,
//   parser: parser,
//   write: (cmd) => serialPort.write(cmd + '\r'),
//   onData: (callback) => parser.on('data', callback)
// };

const connection = null;

const obd = new Ombede(connection);

app.use(express.static('public'));

function startStream() {
  setInterval(() => {
    const data = obd.request(['RPM', 'RPM_UP', 'RPM_DOWN', 'SPEED', 'ETHANOL_PERCENT', 'FUEL_LEVEL', 'FUEL_FLOW', 'GEAR', 'FUEL_EFFICIENCY']);
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