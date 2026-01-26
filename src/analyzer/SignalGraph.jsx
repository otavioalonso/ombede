import { useEffect, useState, useRef } from 'react';

import { bigEndianStartBit } from '../../server/utils';

import './SignalGraph.css';


// Unified Signal Graph Modal - same UI for creating and editing signals
export default function SignalGraph({ signal, frameId, dataHistory, onClose, onEditBitRange, onDelete, onUpdate }) {
  const canvasRef = useRef(null);
  const [timeWindow, setTimeWindow] = useState(10);
  const [localName, setLocalName] = useState(signal.name || '');
  const [localFactor, setLocalFactor] = useState(signal.factor || 1);
  const [localOffset, setLocalOffset] = useState(signal.offset || 0);
  const [localUnit, setLocalUnit] = useState(signal.unit || '');

  // Update signal when any field changes
  const handleNameChange = (value) => {
    setLocalName(value);
    if (value.trim()) {
      onUpdate({ ...signal, name: value, factor: localFactor, offset: localOffset, unit: localUnit });
    }
  };

  const handleFactorChange = (value) => {
    const newFactor = parseFloat(value) || 1;
    setLocalFactor(newFactor);
    onUpdate({ ...signal, name: localName, factor: newFactor, offset: localOffset, unit: localUnit });
  };

  const handleOffsetChange = (value) => {
    const newOffset = parseFloat(value) || 0;
    setLocalOffset(newOffset);
    onUpdate({ ...signal, name: localName, factor: localFactor, offset: newOffset, unit: localUnit });
  };

  const handleUnitChange = (value) => {
    setLocalUnit(value);
    onUpdate({ ...signal, name: localName, factor: localFactor, offset: localOffset, unit: value });
  };

  const handleDelete = () => {
    onDelete(signal, frameId);
  };

  // Canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Get data for this signal
    const now = Date.now();
    const minTime = now - timeWindow * 1000;
    
    // Recalculate values with current factor/offset
    const data = dataHistory
      .filter(d => d.time >= minTime)
      .map(d => {
        // Reverse original transformation and apply new one
        const rawValue = (d.value - (signal.offset || 0)) / (signal.factor || 1);
        const newValue = rawValue * localFactor + localOffset;
        return { time: d.time, value: newValue };
      });

    if (data.length === 0) {
      ctx.fillStyle = '#718096';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for data...', width / 2, height / 2);
      return;
    }

    // Calculate value range
    const values = data.map(d => d.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    
    // Add some padding to the range
    const range = maxVal - minVal || 1;
    minVal -= range * 0.1;
    maxVal += range * 0.1;

    // Draw grid
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.1)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Value labels
      const val = maxVal - ((maxVal - minVal) / 4) * i;
      ctx.fillStyle = '#718096';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
    }

    // Time axis labels
    ctx.fillStyle = '#718096';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const x = padding.left + (graphWidth / 4) * i;
      const t = -timeWindow + (timeWindow / 4) * i;
      ctx.fillText(`${t}s`, x, height - 8);
    }

    // Draw line
    ctx.strokeStyle = '#4fd1c5';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    data.forEach((d, i) => {
      const x = padding.left + ((d.time - minTime) / (timeWindow * 1000)) * graphWidth;
      const y = padding.top + ((maxVal - d.value) / (maxVal - minVal)) * graphHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Current value
    const lastValue = data[data.length - 1]?.value;
    if (lastValue !== undefined) {
      ctx.fillStyle = '#68d391';
      ctx.font = 'bold 24px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lastValue.toFixed(2)}${localUnit}`, width - padding.right, padding.top);
    }
  }, [dataHistory, timeWindow, signal, localFactor, localOffset, localUnit]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="graph-modal" onClick={e => e.stopPropagation()}>
        <div className="graph-header">
          <input 
            type="text"
            className="signal-name-input"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Signal name..."
          />
          <div className="graph-controls">
            <label>
              Time:
              <select value={timeWindow} onChange={e => setTimeWindow(Number(e.target.value))}>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </label>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="graph-info">
          Frame: 0x{frameId.toString(16).toUpperCase().padStart(3, '0')} | 
          Bits: {bigEndianStartBit(signal.start_bit)} - {bigEndianStartBit(signal.start_bit) + signal.bit_length - 1}
        </div>
        <div className="graph-edit-controls">
          <div className="edit-inputs">
            <label>
              Factor:
              <input 
                type="number" 
                step="any"
                value={localFactor} 
                onChange={(e) => handleFactorChange(e.target.value)}
              />
            </label>
            <label>
              Offset:
              <input 
                type="number" 
                step="any"
                value={localOffset} 
                onChange={(e) => handleOffsetChange(e.target.value)}
              />
            </label>
            <label>
              Unit:
              <input 
                type="text"
                value={localUnit} 
                onChange={(e) => handleUnitChange(e.target.value)}
                placeholder="e.g., km/h"
                style={{ width: '120px' }}
              />
            </label>
          </div>
          <div className="edit-buttons">
            <button className="btn-edit" onClick={() => onEditBitRange(signal, frameId)}>
              Edit Bit Range
            </button>
            <button className="btn-delete" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} className="signal-canvas" />
      </div>
    </div>
  );
}
