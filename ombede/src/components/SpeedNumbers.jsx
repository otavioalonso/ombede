
import React from "react";
import "./SpeedNumbers.css";

function SpeedNumbers({ speed, gear, rpm, rpmUp, rpmDown }) {
  // Define RPM ranges
  const minRpm = 900;
  const lowCons = 1200;
  const highTorque = 2500;
  const maxRpm = 5000;

  function getRpmColor(val) {
    if (val === null || val === undefined || val < minRpm) return "#888";
    if (val < minRpm) return "#1976d2"; // blue (low)
    if (val >= lowCons && val < highTorque) return "#388e3c"; // green (low consumption)
    if (val >= highTorque && val < maxRpm) return "#efac00ff"; // yellow (high torque)
    if (val >= maxRpm) return "#ed0101ff"; // red (too high)
    return "#888"; // neutral
  }
  
  return (
    <div className="speed-numbers-container gear-layout">
      <div className="gear-visualization">
        <div className="gear-rpm gear-rpm-left">
          <span className="gear-rpm-value" style={{ background: getRpmColor(rpmDown) }}>{rpmDown !== null ? `${Math.round(rpmDown/100)}` : "--"}</span>
        </div>
        <div className="gear-main">
          <span className="gear-number">{gear !== null ? gear : "--"}</span>
        </div>
        <div className="gear-rpm gear-rpm-right">
          <span className="gear-rpm-value" style={{ background: getRpmColor(rpmUp) }}>{rpmUp !== null ? `${Math.round(rpmUp/100)}` : "--"}</span>
        </div>
      <div className="gear-rpm-top">
  <span className="gear-rpm-value gear-rpm-current" style={{ background: getRpmColor(rpm) }}>{rpm !== null ? `${Math.round(rpm/100)}` : "--"}</span>
          </div>
          <div className="gear-rpm-bottom">
            <span className="gear-speed">{speed !== null ? `${Math.round(speed)}` : "--"}</span>
            <span className="gear-speed-unit">km/h</span>
          </div>
      </div>
    </div>
  );
}

export default SpeedNumbers;
