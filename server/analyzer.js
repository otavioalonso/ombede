import { WebSocketServer } from 'ws';
import fs from 'fs';
import http from 'http';
import { parseDbcFile, mergeDbcData } from './dbcParser.js';

// WebSocket server for raw frames
let rawServer = null;
let dataBuffer = [];
let broadcastInterval = null;

const FPS = 25;

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

let lastUpdate = {}

// Parse raw frame string to extract ID and bytes
function parseRawFrame(frameStr) {
    // frame is a string like "frame [frame_id(hex)] [time] 00 1A F8 00 00 00 00 00"
    const words = frameStr.split(' ');
    if (words.length < 11 || words[0] !== 'frame') return null;
    
    const id = parseInt(words[1], 16);
    const time = parseFloat(words[2]);
    if (FPS) {
        if (lastUpdate[id] && (time - lastUpdate[id] < 1/FPS)) return null;
        lastUpdate[id] = time;
    }
    const bytes = words.slice(3, 11).map(b => parseInt(b, 16));
    return { id, time, bytes };
}

function createApi(defaultLexicon) {
    return http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

                    let data;
                    
                    try {
                        data = JSON.parse(fs.readFileSync(lexicon, 'utf8'));
                    } catch (error) {
                        fs.writeFileSync(lexicon, '');
                        data = {messages:[]}
                    }

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
        } else if (pathname === '/api/signals' && req.method === 'PUT') {
            // Update an existing signal
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { frameId, signalName, updates } = JSON.parse(body);

                    const data = JSON.parse(fs.readFileSync(lexicon, 'utf8'));

                    // Find the message and signal
                    const message = data.messages.find(m => m.id === frameId);
                    if (!message || !message.signals) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Signal not found' }));
                        return;
                    }

                    const signal = message.signals.find(s => s.name === signalName);
                    if (!signal) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Signal not found' }));
                        return;
                    }

                    // Update the signal properties
                    Object.assign(signal, updates);

                    // Write back
                    fs.writeFileSync(lexicon, JSON.stringify(data, null, 4));

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    console.error('Error updating signal:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update signal' }));
                }
            });
        } else if (pathname === '/api/signals' && req.method === 'DELETE') {
            // Delete a signal
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { frameId, signalName } = JSON.parse(body);

                    const data = JSON.parse(fs.readFileSync(lexicon, 'utf8'));

                    // Find the message
                    const message = data.messages.find(m => m.id === frameId);
                    if (!message || !message.signals) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Signal not found' }));
                        return;
                    }

                    // Remove the signal
                    message.signals = message.signals.filter(s => s.name !== signalName);

                    // If message has no more signals, optionally remove it (or keep it)
                    // For now, we'll keep the message even if it has no signals

                    // Write back
                    fs.writeFileSync(lexicon, JSON.stringify(data, null, 4));

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    console.error('Error deleting signal:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to delete signal' }));
                }
            });
        } else if (pathname === '/api/signals/sync' && req.method === 'POST') {
            // Sync entire signals state (for undo/redo)
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { signals } = JSON.parse(body);

                    // Rebuild the lexicon structure from flat signals array
                    const messagesMap = new Map();
                    
                    signals.forEach(signal => {
                        const { frameId, messageName, ...signalData } = signal;
                        
                        if (!messagesMap.has(frameId)) {
                            messagesMap.set(frameId, {
                                id: frameId,
                                is_extended_frame: false,
                                is_fd: false,
                                name: messageName || `message_${frameId.toString(16)}`,
                                signals: []
                            });
                        }
                        
                        messagesMap.get(frameId).signals.push(signalData);
                    });
                    
                    // Convert to array and sort by ID
                    const data = {
                        messages: Array.from(messagesMap.values()).sort((a, b) => a.id - b.id)
                    };
                    
                    // Write back
                    fs.writeFileSync(lexicon, JSON.stringify(data, null, 4));

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    console.error('Error syncing signals:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to sync signals' }));
                }
            });
        } else if (pathname === '/api/signals/import-dbc' && req.method === 'POST') {
            // Import DBC file
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { content, mode = 'merge', detectedFrameIds = [] } = JSON.parse(body);
                    
                    // Parse the DBC content
                    const imported = parseDbcFile(content);
                    
                    // Get existing data
                    let existing = { messages: [] };
                    try {
                        existing = JSON.parse(fs.readFileSync(lexicon, 'utf8'));
                    } catch (error) {
                        // File doesn't exist or is invalid, start fresh
                    }
                    
                    // Merge based on mode, passing detected frame IDs
                    const merged = mergeDbcData(existing, imported, mode, detectedFrameIds);
                    
                    // Write back
                    fs.writeFileSync(lexicon, JSON.stringify(merged, null, 4));

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        imported: imported.messages.length,
                        total: merged.messages.length,
                        signals: merged.messages.reduce((acc, m) => acc + m.signals.length, 0)
                    }));
                } catch (error) {
                    console.error('Error importing DBC:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to import DBC file: ' + error.message }));
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

    // Periodically broadcast buffered data
    broadcastInterval = setInterval(() => {
        if (dataBuffer.length > 0) {
            broadcastRaw({ type: 'rawFrame', payload: dataBuffer });
            dataBuffer = [];
        }
    }, FPS ? Math.round(1000 / FPS) : 0.04);

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
