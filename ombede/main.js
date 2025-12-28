import { Connection } from "./cannect.js";
import { KaCalculator } from "./calculator.js";

const connection = new Connection({
    host: '192.168.1.111',
    parser: '../data/ford_ka.json',
    signals: ['rpm', 'speed', 'batteryCharge', 'fuelConsumption', 'odometer'],
    calculator: new KaCalculator(),
    debug: false,
})

connection.connect();

connection.onCalculatedData((data) => {
    console.log(data);
});
