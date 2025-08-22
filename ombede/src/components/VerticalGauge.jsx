import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import "./Gauge.css";

function VerticalGauge({ value, min, max, label, color }) {
  const ref = useRef();
  useEffect(() => {
    const width = 60, height = 100, padding = 20;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    // Scale for value
    const yScale = d3.scaleLinear()
      .domain([min, max])
      .range([height - padding, padding]);

    // Draw background line
    svg.append("line")
      .attr("x1", width / 2)
      .attr("x2", width / 2)
      .attr("y1", padding)
      .attr("y2", height - padding)
      .attr("stroke", "#ddd")
      .attr("stroke-width", 12)
      .attr("class", "vertical-gauge-bg");

    // Draw value line
    if (value !== null) {
      svg.append("line")
        .attr("x1", width / 2)
        .attr("x2", width / 2)
        .attr("y1", yScale(value))
        .attr("y2", height - padding)
        .attr("stroke", color)
        .attr("stroke-width", 12)
        .attr("stroke-linecap", "round")
        .attr("class", "vertical-gauge-value");
    }

    // Value label
    svg.append("text")
      .attr("x", width / 2 + 6)
      .attr("y", yScale(value)/2)
      .attr("text-anchor", "left")
      .attr("font-size", 18)
      .attr("font-weight", "bold")
      .attr("fill", color)
      .attr("class", "vertical-gauge-value-label")
      .text(value !== null ? value : "--");
    // Main label
    // svg.append("text")
    //   .attr("x", width / 2)
    //   .attr("y", height)
    //   .attr("text-anchor", "middle")
    //   .attr("font-size", 16)
    //   .attr("fill", "#333")
    //   .attr("class", "vertical-gauge-label")
    //   .text(label);
  }, [value, min, max, label, color]);

  return <svg ref={ref} width={60} height={170} className="vertical-gauge-svg" />;
}

export default VerticalGauge;
