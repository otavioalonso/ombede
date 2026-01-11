import './FuelBar.css';

const MAX_TANK = 51; // liters
const SEGMENT_INTERVAL = 2; // segment every 2 liters
const SEGMENT_MAJOR = 10; // major segment every 10 liters

export default function FuelBar({ 
  fuelLevel = 0, // percentage 0-100
  ethanolContent = 0, // percentage 0-100
  totalFuelConsumption = 0, // mL
  initialFuelLevel = 0 // percentage 0-100 at start
}) {
  // Convert fuel level percentage to liters (sensor reading - left side)
  const tankLiters = (fuelLevel / 100) * MAX_TANK;
  const ethanolLiters = tankLiters * (ethanolContent / 100);

  // Calculate fuel level based on initial minus injected (right side)
  const initialLiters = (initialFuelLevel / 100) * MAX_TANK;
  const calculatedLiters = Math.max(0, initialLiters - (totalFuelConsumption / 1000));
  const calculatedEthanolLiters = calculatedLiters * (ethanolContent / 100);

  // Generate vertical segments for left bar (sensor)
  const leftSegmentBars = [];
  for (let l = 0; l <= MAX_TANK; l += SEGMENT_INTERVAL) {
    let color = '#333'; // empty
    if (l < tankLiters) {
      if (l < ethanolLiters) {
        color = '#43a047'; // green for ethanol
      } else {
        color = '#e53935'; // red for gasoline
      }
    }
    leftSegmentBars.push({
      liter: l,
      major: l % SEGMENT_MAJOR === 0,
      color,
    });
  }

  // Generate vertical segments for right bar (shows consumed fuel: from calculatedLiters to initialLiters)
  const rightSegmentBars = [];
  for (let l = 0; l <= MAX_TANK; l += SEGMENT_INTERVAL) {
    let color = '#333'; // gray (outside consumed range)
    // Color only the consumed portion: between calculatedLiters and initialLiters
    if (l >= calculatedLiters && l < initialLiters) {
      // Calculate ethanol portion of consumed fuel
      const consumedEthanolLiters = (initialLiters - calculatedLiters) * (ethanolContent / 100);
      const consumedStart = calculatedLiters;
      if (l < consumedStart + consumedEthanolLiters) {
        color = '#43a047'; // green for ethanol consumed
      } else {
        color = '#e53935'; // red for gasoline consumed
      }
    }
    rightSegmentBars.push({
      liter: l,
      major: l % SEGMENT_MAJOR === 0,
      color,
    });
  }

  // Generate tick marks (every 10 liters)
  const ticks = [];
  for (let l = 0; l <= MAX_TANK; l += 10) {
    ticks.push(l);
  }

  return (
    <div className="fuel-bar-container">
      {/* Single bar with left and right segments split in the middle */}
      <div className="fuel-bar">
        {/* Left segments - sensor reading */}
        {leftSegmentBars.map((bar, i) => {
          const isCurrent = Math.abs(bar.liter - tankLiters) < SEGMENT_INTERVAL / 2;
          return (
            <div
              key={`left-${i}`}
              className={`fuel-bar-segment left${bar.major ? ' major' : ''}${isCurrent ? ' current' : ''}`}
              style={{
                bottom: `${(bar.liter / MAX_TANK) * 100}%`,
                backgroundColor: isCurrent ? '#fff' : bar.color,
              }}
            />
          );
        })}
        {/* Right segments - calculated (initial - injected) */}
        {rightSegmentBars.map((bar, i) => {
          const isCurrent = Math.abs(bar.liter - calculatedLiters) < SEGMENT_INTERVAL / 2;
          return (
            <div
              key={`right-${i}`}
              className={`fuel-bar-segment right${bar.major ? ' major' : ''}${isCurrent ? ' current' : ''}`}
              style={{
                bottom: `${(bar.liter / MAX_TANK) * 100}%`,
                backgroundColor: isCurrent ? '#fff' : bar.color,
              }}
            />
          );
        })}
        {ticks.map((l) => {
          const isCurrentLeft = tankLiters >= l - 5 && tankLiters <= l + 5;
          const isCurrentRight = calculatedLiters >= l - 5 && calculatedLiters <= l + 5;
          return (
            <div
              key={l}
              className={`fuel-bar-tick${isCurrentLeft || isCurrentRight ? ' current' : ''}`}
              style={{ bottom: `${(l / MAX_TANK) * 100}%` }}
            >
              <div className="fuel-bar-tick-line" />
              <div className="fuel-bar-tick-label">{l}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
