
import "./FuelLinear.css";

/**
 * Props:
 * - level: total fuel in liters
 * - ethanol: ethanol percentage (0-100)
 * - maxCapacity: tank max capacity in liters
 */
function FuelLinear({ level, ethanol, maxCapacity }) {

  // SVG dimensions
  const width = 50;
  const height = 300;

  // Bar fill heights
  const emptyHeight = (1 - level/100)*height;
  const ethanolHeight = ethanol/100 * level/100 * height;
  const gasolineHeight = (1 - ethanol/100) * level/100 * height;

  return (
    <svg width={width} height={height} className="fuel-linear-svg">
      <path
        d={`M0,0
            H${width-10}
            Q${width},0 ${width},10
            V${emptyHeight}
            H0
            Z`}
        fill="#ddd0"
      />
      <path
        d={`M0,${emptyHeight}
            H${width}
            V${emptyHeight + ethanolHeight + gasolineHeight - 10}
            Q${width},${emptyHeight + ethanolHeight + gasolineHeight} ${width-10},${emptyHeight + ethanolHeight + gasolineHeight}
            H0
            Z`}
        fill="#02ae41ff"
      />
      <path
        d={`M0,${emptyHeight + ethanolHeight}
            C${width * 0.2},${emptyHeight + ethanolHeight - 4} ${width * 0.3},${emptyHeight + ethanolHeight + 4} ${width * 0.5},${emptyHeight + ethanolHeight}
            C${width * 0.7},${emptyHeight + ethanolHeight - 4} ${width * 0.8},${emptyHeight + ethanolHeight + 4} ${width},${emptyHeight + ethanolHeight}
            V${emptyHeight + ethanolHeight + gasolineHeight - 10}
            Q${width},${emptyHeight + ethanolHeight + gasolineHeight} ${width-10},${emptyHeight + ethanolHeight + gasolineHeight}
            H0
            Z`}
        fill="#ed0101ff"
      />
      
      <text
        x={width / 2}
        y={emptyHeight+ 22}
        textAnchor="middle"
        fontSize={22}
        fontWeight="bold"
        fill="#fff"
      >
        {(level/100 * maxCapacity).toFixed(0)}
      </text>
      <text
        x={width / 2}
        y={emptyHeight + 22 + 12}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        fill="#eee"
      >
        liters
      </text>
      
      <text
        x={width / 2}
        y={emptyHeight + ethanolHeight - 8}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill="#fff"
      >
        {ethanol}%
      </text>
      
      <text
        x={width / 2}
        y={emptyHeight + ethanolHeight + 19}
        textAnchor="middle"
        fontSize={14}
        fontWeight="bold"
        fill="#fff"
      >
        {(100-ethanol)}%
      </text>
    </svg>
  );
}

export default FuelLinear;