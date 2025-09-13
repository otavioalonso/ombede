

import { useEffect, useRef } from "react";
import * as d3 from "d3";

import './FuelGauge.css';

function FuelGauge({ level, ethanol, maxCapacity, colorGas='red', colorEthanol='green', colorText='#666'}) {
  const ref = useRef();

  const minAngle = 0;
  const maxAngle = 2*Math.PI;
  const centralAngle = (maxAngle + minAngle)/2;

  const radius = 40, center = {x: 100, y: 75}, width = 4, cornerRadius = 1;

  let arcGas, arcEthanol, pathGas, pathEthanol, ethanolText, gasText, textValue;
  
  function init() {

    arcGas = d3.arc()
      .innerRadius(radius - width)
      .outerRadius(radius)
      .endAngle(centralAngle)
      .cornerRadius(cornerRadius);

    arcEthanol = d3.arc()
      .innerRadius(radius - width)
      .outerRadius(radius)
      .startAngle(centralAngle)
      .cornerRadius(cornerRadius);

    const svg = d3.select(ref.current);

    svg.selectAll("*").remove();

    svg.append("path")
      .attr("d", 
        d3.arc()
        .innerRadius(radius - width)
        .outerRadius(radius)
        .startAngle(minAngle)
        .endAngle(maxAngle)
        .cornerRadius(cornerRadius)
      )
      .attr("fill", "none")
      .attr("stroke", "#eee")
      .attr("stroke-width", width)
      .attr("transform", `translate(${center.x},${center.y})`)
      .attr("class", "gauge-bg");

    pathGas = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", colorGas)
      .attr("stroke-width", width)
      .attr("stroke-linecap", "round")
      .attr("transform", `translate(${center.x},${center.y})`);

    pathEthanol = svg.append("path")
      .attr("fill", "none")
      .attr("stroke", colorEthanol)
      .attr("stroke-width", width)
      .attr("stroke-linecap", "round")
      .attr("transform", `translate(${center.x},${center.y})`);

    textValue = svg.append("text")
      .attr("x", center.x)
      .attr("y", center.y+5)
      .attr("fill", colorText)
      .attr("class", "gauge-value");
      
    svg.append("text")
      .attr("x", center.x)
      .attr("y", center.y+20)
      .attr("fill", colorText)
      .attr("class", "gauge-unit")
      .text('liters');

    ethanolText = svg.append("text")
      .attr("class", "gauge-ethanol")
      .attr('fill', colorEthanol);

    gasText = svg.append("text")
      .attr("class", "gauge-gas")
      .attr('fill', colorGas);
  }

  function update() {

    if (!arcGas || !pathGas || !arcEthanol || !pathEthanol || !textValue) init();
    if (!level) return;

    const gasAngle = centralAngle - level/100*(1-ethanol/100) * 2 * Math.PI;
    const ethanolAngle = centralAngle + level/100 * ethanol/100 * 2 * Math.PI;

    arcGas.startAngle(gasAngle);
    arcEthanol.endAngle(ethanolAngle);

    pathGas.attr("d", arcGas());
    pathEthanol.attr("d", arcEthanol());

    textValue.text(level !== null ? `${Math.round(level*maxCapacity/100)}` : "--");

    ethanolText
      .attr("x", center.x + radius * Math.sin((ethanolAngle + centralAngle)/2) - width)
      .attr("y", center.y - radius * Math.cos((ethanolAngle + centralAngle)/2) + 16)
      .text(ethanol !== null ? `${Math.round(ethanol)}%` : "--");
    
    gasText
      .attr("x", center.x + radius * Math.sin((gasAngle + centralAngle)/2) + width)
      .attr("y", center.y - radius * Math.cos((gasAngle + centralAngle)/2) + 16)
      .text(ethanol !== null ? `${Math.round(100-ethanol)}%` : "--");
  }

  useEffect(update, [level, ethanol]);

  return <svg ref={ref} width={200} height={150} className="gauge-svg" />;
}

export default FuelGauge;