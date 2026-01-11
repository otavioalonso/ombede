import './RpmBar.css';

// Returns color based on RPM value thresholds
function getRpmColor(rpm) {
  if (rpm >= 5000) return '#e53935'; // red
  if (rpm >= 3000) return '#fdd835'; // yellow
  if (rpm >= 1000) return '#43a047'; // green
  return '#1e88e5'; // blue
}

const MAX_RPM = 8000;
const TICK_INTERVAL = 1000; // vertical line every 1000 RPM

export default function RpmBar({ rpm = 0, rpmUp = 0, rpmDown = 0 }) {
  // Clamp values to valid range
  const clamp = (v) => Math.max(0, Math.min(MAX_RPM, v));
  const rpmClamped = clamp(rpm);
  const rpmUpClamped = clamp(rpmUp);
  const rpmDownClamped = clamp(rpmDown);

  // Sort values to determine segment order (lowest to highest)
  const sorted = [
    { key: 'rpmUp', value: rpmUpClamped },
    { key: 'rpm', value: rpmClamped },
    { key: 'rpmDown', value: rpmDownClamped },
  ].sort((a, b) => a.value - b.value);

  // Build segments: from 0 to sorted[0], sorted[0] to sorted[1], sorted[1] to sorted[2]
  const segments = [];
  let prev = 0;
  for (const item of sorted) {
    if (item.value > prev) {
      segments.push({
        start: prev,
        end: item.value,
        color: getRpmColor(item.value),
        key: item.key,
      });
      prev = item.value;
    }
  }

  // Generate tick marks
  const ticks = [];
  for (let t = 0; t <= MAX_RPM; t += TICK_INTERVAL) {
    ticks.push(t);
  }

  return (
    <div className="rpm-bar-container">
      <div className="rpm-bar-label">RPM</div>
      <div className="rpm-bar-track">
        {/* Segments */}
        {segments.map((seg, i) => (
          <div
            key={i}
            className="rpm-bar-segment"
            style={{
              left: `${(seg.start / MAX_RPM) * 100}%`,
              width: `${((seg.end - seg.start) / MAX_RPM) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
        {/* Tick marks */}
        {ticks.map((t) => (
          <div
            key={t}
            className="rpm-bar-tick"
            style={{ left: `${(t / MAX_RPM) * 100}%` }}
          >
            <div className="rpm-bar-tick-line" />
            <div className="rpm-bar-tick-label">{t / 1000}k</div>
          </div>
        ))}
        {/* Current RPM indicator */}
        <div
          className="rpm-bar-needle"
          style={{ left: `${(rpmClamped / MAX_RPM) * 100}%` }}
        />
      </div>
      <div className="rpm-bar-values">
        <span className="rpm-value rpm-down">▼ {rpmDownClamped}</span>
        <span className="rpm-value rpm-current">{rpmClamped}</span>
        <span className="rpm-value rpm-up">▲ {rpmUpClamped}</span>
      </div>
    </div>
  );
}
