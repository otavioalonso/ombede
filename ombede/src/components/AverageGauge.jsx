import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

import './AverageGauge.css';

function AverageGauge({
  value,
  quantity = d => d[1],
  time = d => d[0],
  domain,
  unit = 'km/h',
  format = t => t,
  now = Date.now(),
  size = {height: 150, width: 200},
  margin = {left: 30, right: 30, top: 30, bottom: 30},
  inner_tick_size = 5,
  outer_tick_size = 0,
  tick_interval = 5,
  rings_interval = 0,
  ring_width_range = [1, 2.5],
  hour = 60,
  dt = 1,
  instant_speed = false
}) {
  const svgRef = useRef();

  const [data, setData] = useState([]);
  
  let path, circle_average, circle_averages, text_average, text_instant_speed, time_ticks;

  const get_averages = (data, quantity, now) =>
    d3.range(0, hour / dt + 1, 1).map(i => ({
      dt: i * dt,
      average: i === 0 ?
        quantity(data.filter(d => time(d) <= now).slice(-1)[0]) :
        d3.mean(data.filter(d => time(d) <= now && time(d) > d3.timeSecond.offset(now, -i * dt * hour)).map(d => quantity(d)))
    }));

  function init() {
    const center = {
      x: (size.width - margin.left - margin.right)/2 + margin.left,
      y: (size.height - margin.top - margin.bottom)/2 + margin.top
    };
    const radius = (size.width - margin.left - margin.right)/2;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const averages = get_averages(data, quantity, now);
    const average = d3.mean(data, d => quantity(d));

    svg.attr("class", "aG");
    const r_scale = d3.scaleLinear().domain(domain || [0, 1.5*d3.max(data, d => quantity(d))]).range([0, radius]);
    const t_scale = d3.scaleLinear().domain([0,hour]);
    const lineRadial = d3.lineRadial().curve(d3.curveLinear).radius(d => r_scale(d.average)).angle(d => d.dt*Math.PI/hour*2);

    circle_average = svg.append("circle")
      .attr("class", "circle")
      .attr("cx", center.x)
      .attr("cy", center.y)
      .attr("r", r_scale(average));

    const rings = a => rings_interval > 0 ? d3.range(0, hour, rings_interval).slice(1).map(t => ({ id: t, r: r_scale(a[t].average) })) : [];
    
    circle_averages = svg.append("g")
      .attr("class", "ring")
      .attr("transform", `translate(${center.x},${center.y})`);

    circle_averages.selectAll("circle")
      .data(rings(averages), d => d.id)
      .enter().append("circle")
      .attr("r", d => d.r)
      .attr("stroke", d => d3.hsl(90,0.2,t_scale.range([0.9,0.5])(d.id)))
      .attr("stroke-width", d => t_scale.range(ring_width_range)(d.id));

    time_ticks = svg.append("g")
      .attr("transform", `translate(${center.x},${center.y})`)
      .attr("class", "ticks")
      .selectAll("g")
      .data(d3.range(0, hour, tick_interval))
      .enter().append("g")
      .attr("transform", d => `rotate(${d*hour/tick_interval})`)
      .append("line")
      .attr("x1", r_scale(average)-inner_tick_size)
      .attr("x2", r_scale(average)+outer_tick_size);

    path = svg.append("g")
      .attr("class", "line")
      .append("path")
      .attr("transform", `translate(${center.x},${center.y})`)
      .attr("d", lineRadial(averages));

    text_average = svg.append("text")
      .attr("class", "textAverage")
      .attr("transform", `translate(${center.x},${center.y})`)
      .text(format(average));

    svg.append("text")
      .attr("class", "textUnit")
      .attr("transform", `translate(${center.x},${center.y+16})`)
      .text(unit);

    if (instant_speed) {
      text_instant_speed = svg.append("text")
        .attr("class", "textInstant")
        .attr("transform", `translate(${center.x},${center.y - r_scale(d3.max([
          averages[0].average,
          averages.slice(-1)[0].average,
        average,
      ]))-5})`)
      .text(`${format(averages[0].average)} ${unit}`);
    }
  }

  function update() {

    if (!data || data.length === 0) return;
    if (!path) { init(); return; }
    const averages = get_averages(data, quantity, now);
    const average = d3.mean(data, d => quantity(d));

    const r_scale = d3.scaleLinear().domain(domain || [0, 1.5*d3.max(averages)]).range([0, radius]);
    const lineRadial = d3.lineRadial().curve(d3.curveLinear).radius(d => r_scale(d.average)).angle(d => d.dt*Math.PI/hour*2);

    path.attr("d", lineRadial(averages));
    
    circle_average.attr("r", r_scale(average));

    circle_averages.selectAll("circle")
      .data(rings(averages), d => d.id)
      .attr("r", d => d.r);
    
    time_ticks
      .attr("x1", r_scale(average)-inner_tick_size)
      .attr("x2", r_scale(average)+outer_tick_size);
    
    text_average.text(format(average));

    if (instant_speed) {
      text_instant_speed.text(format(averages[0].average))
        .attr("transform", `translate(${center.x},${center.y - r_scale(d3.max([
          averages[0].average,
          averages.slice(-1)[0].average,
          average,
      ]))-5})`);
    }
  }

  useEffect(() => {
    if (value !== null) {
      // Only add if value or now is different from last entry
      if (data.length === 0 || data[data.length - 1][1] !== value || data[data.length - 1][0] !== now) {
        setData(prev => [...prev, [now, value]]);
      }
    }
  }, [value, now]);

  useEffect(update, [data]);

  return <svg ref={svgRef} width={size.width} height={size.height} />;
}

export default AverageGauge;
