let speed
let now

const express = require('express')
const socketio = require('socket.io')
// const OBD = require('obd-parser');
// const getConnector = require('obd-parser-development-connection');

// const connect = getConnector({});

const app = express()

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (request, response)=> {
    response.render('index')
})

const server = app.listen(process.env.PORT || 3000, () => {
    console.log("server is running")
})

const io = socketio(server, {
    allowEIO3: true
})

io.on('connection', socket => {
    console.log("New user connected")
    io.sockets.emit('reset')

//    OBD.init(connect)
//      .then(function () {
//        var rpmPoller = new OBD.ECUPoller({
//          pid: new OBD.PIDS.VehicleSpeed(),
//          interval: 100
//        });
//
//        rpmPoller.on('data', function (output) {
//            let new_data = {time: new Date(output.ts), speed: output.value}
//            console.log("Sending data: ", new_data)
//            io.sockets.emit('new_data', new_data)
//        });
//
//        rpmPoller.startPolling();
//    });

    speed = 50
    now = Date.now()

    for(let i = 0; i < 99999; i++) {
        setTimeout(() => {
            now = now + 20e3
            speed = speed + 2*(Math.random() - 0.5)
            let new_data = {time: now, speed: speed}
            console.log("Sending data: ", new_data)
            io.sockets.emit('new_data', new_data)
        }, i*100)
    }

})



