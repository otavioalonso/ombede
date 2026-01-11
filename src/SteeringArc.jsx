import './SteeringArc.css';

const MIN_ANGLE = -30; // degrees
const MAX_ANGLE = 30; // degrees
const SEGMENT_INTERVAL = 1; // segment every 2 degrees
const SEGMENT_MAJOR = 10; // major segment every 10 degrees
const ARC_RADIUS = 80; // percentage of container height for segment positioning

// Returns color based on whether segment is within safe zone
function getSegmentColor(segmentAngle, maxSteeringAngle) {
  const absAngle = Math.abs(segmentAngle);
  const safeLimit = maxSteeringAngle || 30;
  
  if (absAngle <= safeLimit) {
    return '#bfbfbfff'; // green - within safe zone
  } else {
    return '#333'; // red - outside safe zone
  }
}

export default function SteeringArc({ steeringAngle = 0, turningRadius = Infinity, maxSteeringAngle = 30 }) {
  // Clamp steering angle to range
  const clampedAngle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, steeringAngle));
  
  // Generate arc segments - all segments show safety zone coloring
  const segments = [];
  for (let deg = MIN_ANGLE; deg <= MAX_ANGLE; deg += SEGMENT_INTERVAL) {
    // Color based on safety zone (green = safe, red = unsafe at current speed)
    const color = getSegmentColor(deg, maxSteeringAngle);
    
    segments.push({
      angle: deg,
      major: deg % SEGMENT_MAJOR === 0,
      color,
    });
  }

  // Generate tick marks (every 10 degrees)
  const ticks = [];
  for (let deg = MIN_ANGLE; deg <= MAX_ANGLE; deg += SEGMENT_MAJOR) {
    ticks.push(deg);
  }

  // Non-linear scaling: amplifies small angles for better visibility at high speeds
  // Square root for angles up to 5°, then linear for larger angles
  const nonLinearScale = (angle, maxAngle = 30) => {
    const sign = angle >= 0 ? 1 : -1;
    const absAngle = Math.abs(angle);
    const threshold = 5; // transition point from sqrt to linear
    
    // Calculate the scaled threshold value (where sqrt meets linear)
    // At threshold: sqrt(5/30) * 30 ≈ 12.25
    const sqrtAtThreshold = Math.sqrt(threshold / maxAngle) * maxAngle;
    
    let scaled;
    if (absAngle <= threshold) {
      // Square root scaling for small angles (0-5°)
      scaled = Math.sqrt(absAngle / maxAngle) * maxAngle;
    } else {
      // Linear scaling for larger angles (5-30°), offset to match at threshold
      // scaled = sqrtAtThreshold + (absAngle - threshold)
      scaled = sqrtAtThreshold + (absAngle - threshold);
    }
    
    return sign * scaled;
  };

  // Convert angle to arc position
  // Uses vw units for both dimensions to maintain circular arc regardless of container aspect ratio
  const angleToPosition = (deg, useNonLinear = true) => {
    // Apply non-linear scaling for the current angle indicator
    const scaledDeg = useNonLinear ? nonLinearScale(deg) : deg;
    
    // Map -30 to +30 steering degrees to a visual arc
    // Negative angle = turning left = left side of arc
    // Positive angle = turning right = right side of arc
    const visualSpread = 1.5; // multiplier for visual spread (1.5 = 90° arc)
    const visualAngle = scaledDeg * visualSpread;
    
    // Convert to radians, with +90 offset so 0° is at the bottom of the arc (curving upward)
    const radians = (visualAngle + 90) * (Math.PI / 180);
    
    // Arc radius in vw units - same unit for both axes ensures circular arc
    const arcRadiusVw = 30; // vw units
    
    // Calculate positions in vw, then we'll apply them as inline styles
    // Negate x so negative angles appear on the left side
    const xVw = -arcRadiusVw * Math.cos(radians);
    const yVw = -arcRadiusVw * Math.sin(radians); // negative so arc curves upward
    
    // Rotation: segments should point radially outward
    const rotation = visualAngle;
    
    return {
      xVw,
      yVw,
      rotation,
    };
  };

  return (
    <div className="steering-arc-container">
      <div className="steering-arc">
        {/* Background segments with safety zone coloring */}
        {segments.map((seg, i) => {
          const pos = angleToPosition(seg.angle, true);
          return (
            <div
              key={i}
              className={`steering-arc-segment${seg.major ? ' major' : ''}`}
              style={{
                left: '50%',
                top: '100%',
                transform: `translate(-50%, -50%) translate(${pos.xVw}vw, ${pos.yVw}vw) rotate(${pos.rotation}deg)`,
                backgroundColor: seg.color,
              }}
            />
          );
        })}
        {/* Current angle indicator */}
        {(() => {
          const pos = angleToPosition(clampedAngle, true);
          return (
            <div
              className="steering-arc-segment current"
              style={{
                left: '50%',
                top: '100%',
                transform: `translate(-50%, -50%) translate(${pos.xVw}vw, ${pos.yVw}vw) rotate(${pos.rotation}deg)`,
                backgroundColor: '#fff',
              }}
            />
          );
        })()}
        {ticks.map((deg) => {
          const pos = angleToPosition(deg, true);
          return (
            <div
              key={deg}
              className="steering-arc-tick"
              style={{
                left: '50%',
                top: '100%',
                transform: `translate(-50%, -50%) translate(${pos.xVw}vw, ${pos.yVw}vw) rotate(${pos.rotation}deg)`,
              }}
            >
              <div className="steering-arc-tick-label">{deg}°</div>
            </div>
          );
        })}
      </div>
      <div className="steering-arc-value">
        <span className="steering-arc-number">
          {turningRadius == null || turningRadius === Infinity || !isFinite(turningRadius) ? '∞' : `${turningRadius.toFixed(0)}`}
        </span>
        <span className="steering-arc-unit">
          {turningRadius == null || turningRadius === Infinity || !isFinite(turningRadius) ? '' : 'm'}
        </span>
      </div>
    </div>
  );
}