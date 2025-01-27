AverageGauge = function(svg, data, {
  quantity = d => d[1],
  time = d => d[0],
  domain = [0, d3.max(data, d => quantity(d))],
  format = t => t,
  now = Date.now(),
  size = {height: 300, width: 400},
  margin = {left: 30, right: 30, top: 30, bottom: 30},
  center = {x: (size.width - margin.left - margin.right)/2 + margin.left,
            y: (size.height - margin.top - margin.bottom)/2 + margin.top},
  radius = (size.width - margin.left - margin.right)/2,
  inner_tick_size = 5,
  outer_tick_size = 0,
  tick_interval = 5,
  rings_interval = 0,
  ring_width_range = [1, 2.5],
} = {}){

  const get_averages = (data, quantity, now, dt=1) =>
    d3.range(0,60/dt+1,1)
    .map(i => ({dt: i*dt,
                average: i == 0 ?
                  quantity(data.filter(d => time(d) <= now).slice(-1)[0]) :
                  d3.mean(data.filter(d => time(d) < now &&
                                      time(d) > d3.timeSecond.offset(now,-i*dt*60))
                          .map(d => quantity(d)))
               }));

  let averages
  let average

  svg.attr("class", "aG");

  const r_scale = d3.scaleLinear()
    .domain(domain)
    .range([0, radius]);

  const t_scale = d3.scaleLinear()
    .domain([0,60]);

  const lineRadial = d3.lineRadial()
    .curve(d3.curveLinear)
    .radius(d => r_scale(d.average))
    .angle(d => d.dt*Math.PI/30);

  const circle_average = svg.append("circle")
    .attr("class", "circle")
    .attr("cx", center.x)
    .attr("cy", center.y)

  const time_ticks = svg.append("g")
    .attr("transform", `translate(${center.x},${center.y})`)
    .attr("class", "ticks")
    .selectAll("g")
    .data(d3.range(0, 60, tick_interval))
    .enter().append("g")
    .attr("transform", d => `rotate(${d*6})`)
    .append("line")

  const path = svg.append("g")
    .attr("class", "line")
    .append("path")
    .attr("transform", `translate(${center.x},${center.y})`)

  const text_average = svg.append("text")
    .attr("class", "textAverage")
    .attr("transform", `translate(${center.x},${center.y})`)

  const text_instant_speed = svg.append("text")
    .attr("class", "textInstant")

  // Exposes the update method
  return Object.assign(svg.node(), {update(data, now) {
    averages = get_averages(data, quantity, now);
    average = d3.mean(data, d => quantity(d));

    path.attr("d", lineRadial(averages));

    circle_average.attr("r", r_scale(average));

    time_ticks
      .attr("x1", r_scale(average)-inner_tick_size)
      .attr("x2", r_scale(average)+outer_tick_size);

    text_average.text(format(average));

    text_instant_speed.text(format(averages[0].average))
      .attr("transform", `translate(${center.x},${center.y - r_scale(d3.max([
        averages[0].average,
        averages.slice(-1)[0].average,
        average,
      ]))-5})`);

    return now;
  }});
}
