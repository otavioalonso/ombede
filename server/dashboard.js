import { WebSocketServer } from 'ws';

// WebSocket server for calculated/dashboard data
let server = null;
let dataBuffer = [];
let broadcastInterval = null;

function broadcast(data) {
    if (!server) return;
    const message = JSON.stringify(data);
    server.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}

function startDashboardServer(options = {}) {
    const { port = 3002, fps = 25 } = options;
    const intervalMs = Math.round(1000 / fps);

    // WebSocket server for calculated data
    server = new WebSocketServer({ port });
    console.log(`WebSocket server (dashboard) listening on port ${port}`);

    // Periodically broadcast buffered data
    broadcastInterval = setInterval(() => {
        if (dataBuffer.length > 0) {
            broadcast({ type: 'canData', payload: dataBuffer });
            dataBuffer = [];
        }
    }, intervalMs);

    return { server, broadcast };
}

// Data handler to attach to a connection's onCalculatedData
function createDataHandler() {
    return (data) => {
        dataBuffer.push(data);
    };
}

function stopDashboardServer() {
    if (broadcastInterval) {
        clearInterval(broadcastInterval);
        broadcastInterval = null;
    }
    if (server) {
        server.close();
        server = null;
    }
    dataBuffer = [];
}

export { startDashboardServer, createDataHandler, stopDashboardServer, broadcast };
