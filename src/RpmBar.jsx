import './RpmBar.css';

const MAX_RPM = 8000;
const SEGMENT_LINE_INTERVAL = 100; // vertical line every 100 RPM
const SEGMENT_LINE_MAJOR = 500; // every 5th line (500 RPM) is taller

// Returns color based on RPM value thresholds
function getRpmColor(rpm) {
  if (rpm >= 5000) return '#e53935'; // red
  if (rpm >= 2000) return '#fdcc3aff'; // yellow
  if (rpm >= 1000) return '#00bb09ff'; // green
  return '#1e88e5'; // blue
}

export default function RpmBar({ rpm = 0, rpmUp = 0, rpmDown = 0 }) {

  const regionRanges = [
    { from: 0, to: rpmUp, color: '#777' },
    { from: rpmUp, to: rpm, color: getRpmColor(rpmUp) },
    { from: rpm, to: rpmDown, color: getRpmColor(rpmDown) },
  ];

  // Generate vertical bars (every 100 RPM)
  const segmentBars = [];
  for (let t = 0; t <= MAX_RPM; t += SEGMENT_LINE_INTERVAL) {
    // Determine color for this bar
    let color = '#222'; // default black
    for (const region of regionRanges) {
      if (t >= region.from && t < region.to) {
        color = region.color;
        break;
      }
    }
    segmentBars.push({
      rpm: t,
      major: t % SEGMENT_LINE_MAJOR === 0,
      color,
    });
  }
  // Generate tick marks (every 1000 RPM)
  const ticks = [];
  for (let t = 0; t <= MAX_RPM; t += 1000) {
    ticks.push(t);
  }

  return (
    <div className="rpm-bar">
        {segmentBars.map((bar, i) => {
          const isCurrent = Math.abs(bar.rpm - rpm) < SEGMENT_LINE_INTERVAL/2;
          return (
            <div
              key={i}
              className={`rpm-bar-segment-bar${bar.major ? ' major' : ''}${isCurrent ? ' current' : ''}`}
              style={{
                left: `${(bar.rpm / MAX_RPM) * 100}%`,
                backgroundColor: isCurrent ? '#fff' : bar.color,
              }}
            />
          );
        })}
        {ticks.map((t) => {
          const isCurrent = (rpm >= t-500) && (rpm <= t + 500);
          return (
            <div
              key={t}
              className={`rpm-bar-tick${isCurrent ? ' current' : ''}`}
              style={{ left: `${(t / MAX_RPM) * 100}%` }}
            >
              <div className="rpm-bar-tick-line" />
              <div className="rpm-bar-tick-label">{t / 1000}</div>
            </div>
          );
        })}
      </div>
  );
}
