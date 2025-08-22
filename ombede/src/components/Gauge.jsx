

import { useEffect, useRef } from "react";
import * as d3 from "d3";

import './Gauge.css';

function Gauge({ value, min, max, label, unit, color='blue', value2 = 0, color2='red', colorText=color}) {
  const ref = useRef();

  let arcValue, arcValue2, arcPath, arcPath2, textValue;
  
  function init() {
    const radius = 60, center = 75, width = 5, cornerRadius = 10;

    const arcBg = d3.arc()
      .innerRadius(radius - width)
      .outerRadius(radius)
      .startAngle(-Math.PI/2)
      .endAngle(Math.PI/2)
      .cornerRadius(cornerRadius);

    arcValue = d3.arc()
      .innerRadius(radius - width)
      .outerRadius(radius)
      .startAngle(-Math.PI/2)
      .cornerRadius(cornerRadius);

    arcValue2 = d3.arc()
      .innerRadius(radius - width)
      .outerRadius(radius)
      .cornerRadius(cornerRadius);

    const svg = d3.select(ref.current);

    svg.selectAll("*").remove();

    svg.append("path")
      .attr("d", arcBg())
      .attr("fill", "none")
      .attr("stroke", "#eee")
      .attr("stroke-width", width)
      .attr("transform", `translate(${center},${center})`)
      .attr("class", "gauge-bg");

    arcPath2 = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", color2)
      .attr("stroke-width", width)
      .attr("stroke-linecap", "round")
      .attr("transform", `translate(${center},${center})`);

    arcPath = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", width)
      .attr("stroke-linecap", "round")
      .attr("transform", `translate(${center},${center})`);

    svg.append("text")
      .attr("x", center)
      .attr("y", 95)
      .attr("class", "gauge-label")
      .text(label);

    textValue = svg.append("text")
      .attr("x", center)
      .attr("y", 70)
      .attr("fill", colorText)
      .attr("class", "gauge-value");

    svg.append("text")
      .attr("x", 15)
      .attr("y", 90)
      .attr("class", "gauge-minmax")
      .text(min);

    svg.append("text")
      .attr("x", 135)
      .attr("y", 90)
      .attr("class", "gauge-minmax")
      .text(max);
  }

  function update() {

    if (!arcValue || !arcPath) init();
    const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const fraction2 = Math.max(0, Math.min(1, (value2 - min) / (max - min)));

    arcValue.endAngle(-Math.PI/2 + fraction * Math.PI);

    arcValue2
      .startAngle(-Math.PI/2 + fraction * Math.PI)
      .endAngle(-Math.PI/2 + (fraction + fraction2) * Math.PI);

    arcPath.attr("d", arcValue());
    arcPath2.attr("d", arcValue2()).attr("visibility", fraction2 ? "visible" : "hidden");

    textValue.text(value !== null ? `${Math.round(value+value2)}${unit ? unit : ''}` : "--");
  }

  useEffect(update, [value, value2]);

  return <svg ref={ref} width={150} height={100} className="gauge-svg" />;
}

export default Gauge;