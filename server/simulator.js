// sim.js: Fake CAN data generator for socketcand protocol
// Usage: node server/sim.js [--port 29536] [--lexicon ./can/ford_ka.json]

import net from 'net';
import fs from 'fs';

const PORT = parseInt(process.env.SIM_PORT) || parseInt(process.argv[2]) || 29536;
const LEXICON = process.env.SIM_LEXICON || process.argv[3] || './can/ford_ka.json';
const FRAME_LENGTH = 8;

// Load lexicon
const lexicon = JSON.parse(fs.readFileSync(LEXICON, 'utf8'));

// Helper: Generate random value for a signal
function randomSignalValue(signal) {
    if (signal.states) {
        // Pick a random state value
        const state = signal.states[Math.floor(Math.random() * signal.states.length)];
        return state.value;
    }
    // Generate a random value in the range
    const maxRaw = Math.pow(2, signal.bit_length) - 1;
    const raw = Math.floor(Math.random() * (maxRaw + 1));
    let value = (raw * (signal.factor || 1)) + (signal.offset || 0);
    return value;
}

// Helper: Pack signal value into CAN frame data (big endian, unsigned only)
function packSignal(data, signal, value) {
    // Only supports big endian, unsigned
    let raw = Math.round((value - (signal.offset || 0)) / (signal.factor || 1));
    let bits = raw.toString(2).padStart(signal.bit_length, '0');
    let start = signal.start_bit;
    for (let i = 0; i < signal.bit_length; i++) {
        let bitIndex = start + i;
        let byteIndex = Math.floor(bitIndex / 8);
        let bitInByte = 7 - (bitIndex % 8);
        if (byteIndex < data.length) {
            if (bits[i] === '1') data[byteIndex] |= (1 << bitInByte);
            else data[byteIndex] &= ~(1 << bitInByte);
        }
    }
}

// Generate a random CAN frame for a message
function randomFrame(message) {
    let data = new Array(FRAME_LENGTH).fill(0);
    for (const signal of message.signals) {
        if (!signal.is_big_endian || signal.is_signed) continue; // Only support big-endian unsigned
        const value = randomSignalValue(signal);
        packSignal(data, signal, value);
    }
    return data;
}

// Format frame as socketcand expects: "frame [id(hex)] [timestamp] [8 bytes]"
function formatFrame(message, data) {
    const idHex = message.id.toString(16);
    const timestamp = (Date.now() / 1000).toFixed(6);
    const bytes = data.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    return `frame ${idHex} ${timestamp} ${bytes}`;
}

// TCP server for socketcand protocol
const server = net.createServer((socket) => {
    console.log('Sim: Client connected');
    socket.on('end', () => console.log('Sim: Client disconnected'));
    // Simple handshake: respond to <open> and <subscribe>
    socket.on('data', (data) => {
        const msg = data.toString('utf8');
        if (msg.includes('open')) {
            socket.write('<ok>');
            console.log('Sim: Client opened channel');
        }
        if (msg.includes('subscribe')) {
            socket.write('<ok>');
            console.log('Sim: Client subscribed to messages');
        }
    });
    // Periodically send random frames for all messages
    const interval = setInterval(() => {
        for (const message of lexicon.messages) {
            const data = randomFrame(message);
            const frame = formatFrame(message, data);
            socket.write('<' + frame + '>\n');
        }
    }, 100);
    socket.on('close', () => clearInterval(interval));
    socket.on('error', () => clearInterval(interval));
});

server.listen(PORT, () => {
    console.log(`Sim: Fake CAN server listening on port ${PORT}`);
    console.log(`Sim: Using lexicon ${LEXICON}`);
});
