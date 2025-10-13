import { Connection } from "./cannect.js";

const connection = new Connection({
    host: '192.168.1.111',
    parser: '../data/ford_ka.json',
    signals: ['RPM', 'HandBrake'],
    debug: false,
})

connection.onParsedFrame((data) => {
    console.log(data);
});
