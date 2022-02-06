'use strict';

var OBD = require('obd-parser');

var getConnector = require('obd-parser-development-connection');

var connect = getConnector({});

OBD.init(connect)
  .then(function () {
    var rpmPoller = new OBD.ECUPoller({
      pid: new OBD.PIDS.VehicleSpeed(),
      interval: 100
    });

    rpmPoller.on('data', function (output) {
      console.log('==== Got Speed Output ====');
      console.log('time: ', output.ts);
      console.log('bytes: ', output.bytes);
      console.log('value: ', output.value);
      console.log('pretty: ', output.pretty);
    });

    rpmPoller.startPolling();
});
