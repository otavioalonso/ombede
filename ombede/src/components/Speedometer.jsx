

import { useEffect, useRef } from "react";
import * as d3 from "d3";

import './Speedometer.css';

function Speedometer({ speed, rpm, rpmGearUp, rpmGearDown}) {
  const ref = useRef();

  function init() {
  }

  function update() {

  }

  useEffect(update, [speed, rpm, rpmGearUp, rpmGearDown]);

  return <svg ref={ref} width={200} height={150} className="speedometer-svg" />;
}

export default Speedometer;