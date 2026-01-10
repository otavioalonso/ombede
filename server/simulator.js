// simulator.js: Fake CAN data generator for socketcand protocol
// Usage: node server/simulator.js

import net from 'net';
import fs from 'fs';
import readline from 'readline';

const PORT = parseInt(process.env.SIM_PORT) || 29536;
const LEXICON = process.env.SIM_LEXICON || './can/ford_ka.json';
const FRAME_LENGTH = 8;
const DEBUG = process.env.SIM_DEBUG === 'true';

const REPLAY = process.env.REPLAY || false;
// If REPLAY_LOOP=true the replay will loop when it reaches EOF
const REPLAY_LOOP = process.env.REPLAY_LOOP === 'true';
// Replay speed multiplier: 1 = real time, 2 = twice as fast, 0.5 = half speed
const REPLAY_RATE = parseFloat(process.env.REPLAY_RATE) || 1.0;

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
    // If replay is enabled, stream frames from a CAN log instead of random frames
    let interval = null;
    let replayController = null; // used to stop replay when socket closes
    if (REPLAY) {
        if (!fs.existsSync(REPLAY)) {
            console.error(`Sim: Replay enabled but log not found: ${REPLAY}`);
        } else {
            // Chunked streaming replay: read CHUNK_SIZE lines, schedule them, then read more
            const CHUNK_SIZE = 1000;

            replayController = {
                stopped: false,
                timers: [],
                rl: null,
                stop() {
                    this.stopped = true;
                    for (const t of this.timers) clearTimeout(t);
                    this.timers = [];
                    if (this.rl) this.rl.close();
                }
            };

            function startReplay() {
                const rl = readline.createInterface({
                    input: fs.createReadStream(REPLAY),
                    crlfDelay: Infinity
                });
                replayController.rl = rl;

                let startTs = null;
                let replayStartTime = Date.now();
                let chunk = [];
                let paused = false;

                function scheduleChunk() {
                    if (replayController.stopped || chunk.length === 0) return;

                    for (const rec of chunk) {
                        const delaySec = (rec.ts - startTs) / REPLAY_RATE;
                        const targetTime = replayStartTime + delaySec * 1000;
                        const delayMs = Math.max(0, targetTime - Date.now());

                        const t = setTimeout(() => {
                            if (replayController.stopped) return;
                            const fakeMessage = { id: rec.id, signals: [] };
                            const data = new Array(FRAME_LENGTH).fill(0);
                            for (let i = 0; i < Math.min(rec.bytes.length, FRAME_LENGTH); i++) data[i] = rec.bytes[i];
                            const frame = formatFrame(fakeMessage, data);
                            socket.write('<' + frame + '>' + '\n');
                            if (DEBUG) console.log('REPLAY:', frame);
                        }, delayMs);
                        replayController.timers.push(t);
                    }

                    // Schedule next chunk read when ~80% through current chunk timing
                    const lastRec = chunk[chunk.length - 1];
                    const chunkDurationMs = ((lastRec.ts - startTs) / REPLAY_RATE) * 1000;
                    const nextReadDelay = Math.max(0, chunkDurationMs * 0.8 - (Date.now() - replayStartTime));

                    chunk = [];

                    if (paused) {
                        const t = setTimeout(() => {
                            if (!replayController.stopped) {
                                paused = false;
                                rl.resume();
                            }
                        }, nextReadDelay);
                        replayController.timers.push(t);
                    }
                }

                rl.on('line', (line) => {
                    if (replayController.stopped) {
                        rl.close();
                        return;
                    }
                    // Expect format: frame <id(hex)> <timestamp> <b0> <b1> ...
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 4) return;
                    const id = parseInt(parts[1], 16);
                    const ts = parseFloat(parts[2]);
                    const bytes = parts.slice(3).map(b => parseInt(b, 16));

                    if (startTs === null) {
                        startTs = ts;
                        replayStartTime = Date.now();
                    }

                    chunk.push({ id, ts, bytes });

                    if (chunk.length >= CHUNK_SIZE) {
                        rl.pause();
                        paused = true;
                        scheduleChunk();
                    }
                });

                rl.on('close', () => {
                    // Schedule any remaining lines in the last partial chunk
                    if (chunk.length > 0 && !replayController.stopped) {
                        scheduleChunk();
                    }
                    if (replayController.stopped) return;
                    if (REPLAY_LOOP) {
                        // Wait for last frame to be sent, then restart
                        const lastTimer = replayController.timers[replayController.timers.length - 1];
                        const restartDelay = lastTimer ? 100 : 0;
                        const t = setTimeout(() => {
                            if (!replayController.stopped) {
                                replayController.timers = [];
                                startReplay();
                            }
                        }, restartDelay);
                        replayController.timers.push(t);
                    }
                });

                rl.on('error', (err) => {
                    console.error('Sim: Error reading replay log:', err);
                });
            }

            // Start streaming replay
            startReplay();

            // Stop on socket close/error
            socket.on('close', () => replayController && replayController.stop());
            socket.on('error', () => replayController && replayController.stop());
        }
    } else {
        // Periodically send random frames for all messages
        interval = setInterval(() => {
            for (const message of lexicon.messages) {
                const data = randomFrame(message);
                const frame = formatFrame(message, data);
                socket.write('<' + frame + '>' + '\n');
                if (DEBUG) console.log(frame);
            }
        }, 100);
        socket.on('close', () => clearInterval(interval));
        socket.on('error', () => clearInterval(interval));
    }
});

server.listen(PORT, () => {
    console.log(`Sim: Fake CAN server listening on port ${PORT}`);
    console.log(`Sim: Using lexicon ${LEXICON}`);
});
