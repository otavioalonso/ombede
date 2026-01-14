import { WebSocketServer } from 'ws';
import fs from 'fs';
import http from 'http';

const SIGNALS_FILE = './can/ford_ka.json';

// WebSocket server for raw frames
let rawServer = null;
let dataBuffer = [];
let broadcastInterval = null;

// HTTP server for API
let httpServer = null;

function broadcastRaw(data) {
    if (!rawServer) return;
    const message = JSON.stringify(data);
    rawServer.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}

// Parse raw frame string to extract ID and bytes
function parseRawFrame(frameStr) {
    // frame is a string like "frame [frame_id(hex)] [time] 00 1A F8 00 00 00 00 00"
    const words = frameStr.split(' ');
    if (words.length < 11 || words[0] !== 'frame') return null;
    
    const id = parseInt(words[1], 16);
    const bytes = words.slice(3, 11).map(b => parseInt(b, 16));
    return { id, bytes };
}

function createApi(defaultLexicon) {
    return http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Parse URL and query params
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const pathname = parsedUrl.pathname;
        const fileParam = parsedUrl.searchParams.get('file');
        const lexicon = fileParam ? `./can/${fileParam}` : defaultLexicon;

        if (pathname === '/api/signals' && req.method === 'GET') {
            // Return the signals file
            try {
                const data = fs.readFileSync(lexicon, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to read signals file' }));
            }
        } else if (pathname === '/api/signals' && req.method === 'POST') {
            // Add a new signal
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { frameId, signal } = JSON.parse(body);
                    const data = JSON.parse(fs.readFileSync(lexicon, 'utf8'));
                    
                    // Find or create the message entry
                    let message = data.messages.find(m => m.id === frameId);
                    if (!message) {
                        message = {
                            id: frameId,
                            is_extended_frame: false,
                            is_fd: false,
                            name: `message_${frameId.toString(16)}`,
                            signals: []
                        };
                        data.messages.push(message);
                    }
                    
                    // Add the signal
                    if (!message.signals) message.signals = [];
                    message.signals.push(signal);
                    
                    // Sort messages by ID
                    data.messages.sort((a, b) => a.id - b.id);
                    
                    // Write back
                    fs.writeFileSync(lexicon, JSON.stringify(data, null, 4));
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    console.error('Error saving signal:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save signal' }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });
}

function startAnalyzerServer(options = {}) {
    const { rawPort = 3003, apiPort = 3004, lexicon = './can/ford_ka.json' } = options;

    rawServer = new WebSocketServer({ port: rawPort });
    console.log(`WebSocket server (raw frames) listening on port ${rawPort}`);

    httpServer = createApi(lexicon);
    httpServer.listen(apiPort, () => {
        console.log(`HTTP API server listening on port ${apiPort}`);
    });

    const fps = 25;
    const intervalMs = Math.round(1000 / fps);

    // Periodically broadcast buffered data
    broadcastInterval = setInterval(() => {
        if (dataBuffer.length > 0) {
            broadcastRaw({ type: 'rawFrame', payload: dataBuffer });
            dataBuffer = [];
        }
    }, intervalMs);

    return {
        rawServer,
        httpServer,
        broadcastRaw,
    };
}


// Frame handler to attach to a connection
function createFrameHandler() {
    return (frame) => {
        const parsed = parseRawFrame(frame);
        if (parsed) {
            dataBuffer.push(parsed);
        }
    };
}

export { startAnalyzerServer, createFrameHandler, broadcastRaw };
