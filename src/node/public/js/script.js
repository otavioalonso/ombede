(() => {
    let instant_speed = [];
    let socket = io.connect('http://localhost:3000')

    const chart = AverageGauge(d3.select("svg").attr("viewBox", [0,0, 600, 400]), [], {
      quantity: d => d.speed,
      time: d => d.time,
      domain: [0,100],
      format: t => `${t.toFixed(0)} km/h`,
      })

    socket.on('new_data', data => {
        instant_speed.push(data)
        chart.update(instant_speed, data.time)
    })

    socket.on('reset', () => {
        instant_speed = []
    })

})()
