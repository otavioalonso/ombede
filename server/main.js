import { Connection } from "./cannect.js";
import { KaCalculator } from "./calculator.js";

import { generateLogFilePath } from './utils.js';

import { startDashboardServer, createDataHandler } from './dashboard.js';
import { startAnalyzerServer, createFrameHandler } from './analyzer.js';

startDashboardServer({ port: 3002, fps: 25 });
startAnalyzerServer({ rawPort: 3003, apiPort: 3004});

const connection = new Connection({
    host: 'localhost',
    parser: './can/ford_ka.json',
    signals: ['rpm', 'speed', 'batteryCharge', 'fuelLevel', 'fuelConsumption', 'fuelEthanolFraction', 'odometer', 'steeringAngle'],
    calculator: new KaCalculator(),
    debug: false,
    // logFile: generateLogFilePath()
});

connection.connect();

connection.onCalculatedData(createDataHandler());
connection.onFrame(createFrameHandler());