const speed_gen = d3.randomUniform(-1, 1);
const hour = d3.timeSecond.every(10).range(d3.timeHour.offset(Date.now(),-6), Date.now());
const speed = d3.cumsum(hour.map(e => speed_gen())).map(e => e+50);
const instant_speed = hour.map((h,i) => ({time: h, speed: speed[i]}));

chart = AverageGauge("svg", instant_speed, {quantity: d => d.speed,
                                            time: d => d.time,
                                            domain: [0,100]})

var instant_speed_realtime;

hour.forEach((now,i) => {
	setTimeout( () => {
		instant_speed_realtime = instant_speed.filter(d => d.time < now)
		chart.update(instant_speed_realtime, now)

	}, i*1000/24)});

