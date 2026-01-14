import { useEffect, useState, useCallback, useRef } from 'react';
import './Signals.css';

// Signal Graph Modal component
function SignalGraphModal({ signal, frameId, dataHistory, onClose }) {
  const canvasRef = useRef(null);
  const [timeWindow, setTimeWindow] = useState(10); // seconds to show

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
    const data = dataHistory
      .filter(d => d.time >= minTime)
      .map(d => ({ time: d.time, value: d.value }));

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

    // Draw points
    ctx.fillStyle = '#4fd1c5';
    data.forEach(d => {
      const x = padding.left + ((d.time - minTime) / (timeWindow * 1000)) * graphWidth;
      const y = padding.top + ((maxVal - d.value) / (maxVal - minVal)) * graphHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Current value
    const lastValue = data[data.length - 1]?.value;
    if (lastValue !== undefined) {
      ctx.fillStyle = '#68d391';
      ctx.font = 'bold 24px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lastValue.toFixed(2)}${signal.unit || ''}`, width - padding.right, padding.top);
    }
  }, [dataHistory, timeWindow, signal]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="graph-modal" onClick={e => e.stopPropagation()}>
        <div className="graph-header">
          <h2>{signal.name}</h2>
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
          Bits: {signal.start_bit} - {signal.start_bit + signal.bit_length - 1} |
          Factor: {signal.factor} | Offset: {signal.offset}
        </div>
        <canvas ref={canvasRef} className="signal-canvas" />
      </div>
    </div>
  );
}

// WebSocket hook for raw CAN frames
function useRawCANWebSocket(onFrame) {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3003');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'rawFrame') {
        onFrame(data.payload);
      }
    };
    return () => ws.close();
  }, [onFrame]);
}

// Convert byte array to array of bit characters ('0' or '1')
function bytesToBits(bytes) {
  if (!bytes || !Array.isArray(bytes)) return [];
  return bytes.map(b => b.toString(2).padStart(8, '0')).join('').split('');
}

// Decode a signal value from raw bytes using signal definition
function decodeSignal(bytes, signal) {
  if (!bytes || !signal) return null;
  
  const bits = bytes.map(b => b.toString(2).padStart(8, '0')).join('');
  
  // For big-endian signals, start_bit is the MSB position
  // Convert to the actual bit range
  const start = 8 * Math.floor(signal.start_bit / 8) + (7 - signal.start_bit % 8);
  const bitString = bits.slice(start, start + signal.bit_length);
  
  if (bitString.length !== signal.bit_length) return null;
  
  let rawValue = parseInt(bitString, 2);
  
  // Handle signed values (two's complement)
  if (signal.is_signed && rawValue >= Math.pow(2, signal.bit_length - 1)) {
    rawValue -= Math.pow(2, signal.bit_length);
  }
  
  // Apply factor and offset
  const value = rawValue * (signal.factor || 1) + (signal.offset || 0);
  return value;
}

// Single bit square component
function BitSquare({ value, opacity, isSelected, isHighlighted, onMouseDown, onMouseEnter }) {
  return (
    <div
      className={`bit-square ${value ? 'filled' : 'empty'} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      style={{ opacity }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    />
  );
}

// Byte group component (8 bits)
function ByteGroup({ byteIndex, bits, opacities, selectedBits, highlightedBits, onBitMouseDown, onBitMouseEnter }) {
  return (
    <div className="byte-group">
      <div className="byte-label">{byteIndex}</div>
      <div className="byte-bits">
        {bits.map((bit, bitIdx) => {
          const globalBitIndex = byteIndex * 8 + bitIdx;
          return (
            <BitSquare
              key={bitIdx}
              value={bit === '1'}
              opacity={opacities[bitIdx]}
              isSelected={selectedBits.has(globalBitIndex)}
              isHighlighted={highlightedBits.has(globalBitIndex)}
              onMouseDown={() => onBitMouseDown(globalBitIndex)}
              onMouseEnter={() => onBitMouseEnter(globalBitIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}

// CAN message row component
function CANMessageRow({ 
  frameId, 
  bytes, 
  lastChangeTime, 
  fadeEnabled, 
  currentTime,
  selectedBits,
  onBitMouseDown,
  onBitMouseEnter,
  signals,
  messageName,
  onSignalClick
}) {
  const [hoveredSignal, setHoveredSignal] = useState(null);
  const bits = bytesToBits(bytes);
  
  // Calculate opacity for each bit based on last change time
  const bitOpacities = lastChangeTime.map(time => {
    if (!fadeEnabled) return 1;
    const elapsed = (currentTime - time) / 1000;
    if (elapsed < 1) return 1;
    // Fade from 1 to 0.1 over 1 second after 1 second timeout
    const fadeProgress = Math.min((elapsed - 1) / 1, 1);
    return 1 - fadeProgress * 0.9;
  });

  // Group bits by byte
  const byteGroups = [];
  for (let i = 0; i < 8; i++) {
    byteGroups.push({
      byteIndex: i,
      bits: bits.slice(i * 8, (i + 1) * 8),
      opacities: bitOpacities.slice(i * 8, (i + 1) * 8),
    });
  }

  // Find signals that apply to this frame and decode their values
  const frameSignals = signals.filter(s => s.frameId === frameId);
  const isKnownFrame = frameSignals.length > 0;

  // Format signal value for display
  const formatValue = (value, signal) => {
    if (value === null || value === undefined) return '?';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  };

  // Calculate highlighted bits from hovered signal
  const highlightedBits = new Set();
  if (hoveredSignal) {
    // Convert start_bit to the linear bit index (same conversion as decodeSignal)
    const start = 8 * Math.floor(hoveredSignal.start_bit / 8) + (7 - hoveredSignal.start_bit % 8);
    for (let i = 0; i < hoveredSignal.bit_length; i++) {
      highlightedBits.add(start + i);
    }
  }

  return (
    <div className={`can-message-row ${isKnownFrame ? 'known-frame' : ''}`}>
      <div className="frame-id">
        0x{frameId.toString(16).toUpperCase().padStart(3, '0')}
        {/* {messageName && <span className="message-name">{messageName}</span>} */}
      </div>
      <div className="frame-bytes">
        {byteGroups.map((group) => (
          <ByteGroup
            key={group.byteIndex}
            byteIndex={group.byteIndex}
            bits={group.bits}
            opacities={group.opacities}
            selectedBits={selectedBits.get(frameId) || new Set()}
            highlightedBits={highlightedBits}
            onBitMouseDown={(bitIdx) => onBitMouseDown(frameId, bitIdx)}
            onBitMouseEnter={(bitIdx) => onBitMouseEnter(frameId, bitIdx)}
          />
        ))}
      </div>
      <div className="frame-signals">
        {frameSignals.map((s, i) => {
          const value = decodeSignal(bytes, s);
          return (
            <span 
              key={i} 
              className="signal-badge" 
              title={`Click to see graph. Bits ${s.start_bit}-${s.start_bit + s.bit_length - 1}`}
              onMouseEnter={() => setHoveredSignal(s)}
              onMouseLeave={() => setHoveredSignal(null)}
              onClick={() => onSignalClick(s, frameId)}
            >
              <span className="signal-name">{s.name}</span>
              <span className="signal-value">{formatValue(value, s)}{s.unit || ''}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Signal definition modal
function SignalModal({ frameId, startBit, endBit, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [factor, setFactor] = useState('1');
  const [offset, setOffset] = useState('0');
  const [unit, setUnit] = useState('');
  const [isSigned, setIsSigned] = useState(false);

  const bitLength = Math.abs(endBit - startBit) + 1;
  const actualStartBit = Math.min(startBit, endBit);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      start_bit: actualStartBit,
      bit_length: bitLength,
      factor: parseFloat(factor),
      offset: parseFloat(offset),
      unit,
      is_big_endian: true,
      is_float: false,
      is_signed: isSigned,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Define Signal</h2>
        <p className="modal-info">
          Frame: 0x{frameId.toString(16).toUpperCase().padStart(3, '0')} | 
          Bits: {actualStartBit} - {actualStartBit + bitLength - 1} ({bitLength} bits)
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Signal Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., engineTemp"
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Factor</label>
              <input 
                type="number" 
                step="any"
                value={factor} 
                onChange={(e) => setFactor(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Offset</label>
              <input 
                type="number" 
                step="any"
                value={offset} 
                onChange={(e) => setOffset(e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unit</label>
              <input 
                type="text" 
                value={unit} 
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., °C, km/h"
              />
            </div>
            <div className="form-group checkbox">
              <label>
                <input 
                  type="checkbox" 
                  checked={isSigned} 
                  onChange={(e) => setIsSigned(e.target.checked)}
                />
                Signed
              </label>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
            <button type="submit" className="btn-save" disabled={!name}>Save Signal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Signals() {
  // State for all received frames: Map<frameId, { bytes, lastChangeTime[] }>
  const [frames, setFrames] = useState(new Map());
  const [fadeEnabled, setFadeEnabled] = useState(true); // enable fading
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null); // { frameId, bitIndex }
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedBits, setSelectedBits] = useState(new Map()); // Map<frameId, Set<bitIndex>>
  const [showModal, setShowModal] = useState(false);
  const [signals, setSignals] = useState([]);
  const [lexiconFile, setLexiconFile] = useState('ford_ka.json');
  
  // Signal graph state
  const [graphSignal, setGraphSignal] = useState(null);
  const [graphFrameId, setGraphFrameId] = useState(null);
  const signalHistoryRef = useRef(new Map()); // Map<"frameId:signalName", Array<{time, value}>>

  // Update current time for fade calculations
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  // Load existing signals
  useEffect(() => {
    fetch(`/api/signals?file=${encodeURIComponent(lexiconFile)}`)
      .then(res => res.json())
      .then(data => {
        // Flatten signals with their frame IDs
        const allSignals = [];
        data.messages?.forEach(msg => {
          msg.signals?.forEach(sig => {
            allSignals.push({ ...sig, frameId: msg.id, messageName: msg.name });
          });
        });
        setSignals(allSignals);
      })
      .catch(console.error);
  }, [lexiconFile]);

  // Handle incoming raw frames
  const handleFrame = useCallback((frame) => {
    const now = Date.now();
    
    // Update signal history for any known signals on this frame
    signals.filter(s => s.frameId === frame.id).forEach(signal => {
      const value = decodeSignal(frame.bytes, signal);
      if (value !== null) {
        const key = `${frame.id}:${signal.name}`;
        const history = signalHistoryRef.current.get(key) || [];
        history.push({ time: now, value });
        // Keep only last 60 seconds of data
        const cutoff = now - 60000;
        const filtered = history.filter(d => d.time >= cutoff);
        signalHistoryRef.current.set(key, filtered);
      }
    });

    setFrames(prev => {
      const next = new Map(prev);
      const existing = next.get(frame.id);
      
      if (existing) {
        // Compare each bit and update lastChangeTime for changed bits
        const oldBits = bytesToBits(existing.bytes);
        const newBits = bytesToBits(frame.bytes);
        const newLastChangeTime = existing.lastChangeTime.map((time, i) => 
          oldBits[i] !== newBits[i] ? now : time
        );
        next.set(frame.id, {
          bytes: frame.bytes,
          lastChangeTime: newLastChangeTime,
          lastSeen: now,
        });
      } else {
        // New frame, all bits just changed
        next.set(frame.id, {
          bytes: frame.bytes,
          lastChangeTime: new Array(64).fill(now),
          lastSeen: now,
        });
      }
      return next;
    });
  }, [signals]);

  useRawCANWebSocket(handleFrame);

  // Selection handling
  const handleBitMouseDown = (frameId, bitIndex) => {
    setIsSelecting(true);
    setSelectionStart({ frameId, bitIndex });
    setSelectionEnd({ frameId, bitIndex });
    setSelectedBits(new Map([[frameId, new Set([bitIndex])]]));
  };

  const handleBitMouseEnter = (frameId, bitIndex) => {
    if (!isSelecting || !selectionStart) return;
    // Only allow selection within the same frame
    if (frameId !== selectionStart.frameId) return;
    
    setSelectionEnd({ frameId, bitIndex });
    
    // Update selected bits (range from start to current)
    const start = Math.min(selectionStart.bitIndex, bitIndex);
    const end = Math.max(selectionStart.bitIndex, bitIndex);
    const selected = new Set();
    for (let i = start; i <= end; i++) {
      selected.add(i);
    }
    setSelectedBits(new Map([[frameId, selected]]));
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionStart && selectionEnd) {
      // Show modal to define the signal
      setShowModal(true);
    }
    setIsSelecting(false);
  };

  const handleSignalClick = (signal, frameId) => {
    setGraphSignal(signal);
    setGraphFrameId(frameId);
  };

  const handleCloseGraph = () => {
    setGraphSignal(null);
    setGraphFrameId(null);
  };

  const handleSaveSignal = async (signal) => {
    if (!selectionStart) return;
    
    try {
      const response = await fetch(`/api/signals?file=${encodeURIComponent(lexiconFile)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameId: selectionStart.frameId,
          signal,
        }),
      });
      
      if (response.ok) {
        // Add to local state
        setSignals(prev => [...prev, { ...signal, frameId: selectionStart.frameId }]);
        setShowModal(false);
        setSelectedBits(new Map());
        setSelectionStart(null);
        setSelectionEnd(null);
      } else {
        console.error('Failed to save signal');
      }
    } catch (error) {
      console.error('Error saving signal:', error);
    }
  };

  const handleCancelModal = () => {
    setShowModal(false);
    setSelectedBits(new Map());
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Sort frames by ID
  const sortedFrames = Array.from(frames.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="signals-container" onMouseUp={handleMouseUp}>
      <header className="signals-header">
        <h1>CAN Signal Analyzer</h1>
        <div className="controls">
          <label>
            <input 
              type="checkbox" 
              checked={fadeEnabled}
              onChange={(e) => setFadeEnabled(e.target.checked)}
            />
            Fade
          </label>
          <label>
            File:
            <input 
              type="text" 
              value={lexiconFile}
              onChange={(e) => setLexiconFile(e.target.value)}
              placeholder="ford_ka.json"
            />
          </label>
        </div>
      </header>

      <div className="signals-list">
        {sortedFrames.map(([frameId, frameData]) => {
          // Find message name from signals
          const frameSignal = signals.find(s => s.frameId === frameId);
          const messageName = frameSignal?.messageName || null;
          
          return (
            <CANMessageRow
              key={frameId}
              frameId={frameId}
              bytes={frameData.bytes}
              lastChangeTime={frameData.lastChangeTime}
              fadeEnabled={fadeEnabled}
              currentTime={currentTime}
              selectedBits={selectedBits}
              onBitMouseDown={handleBitMouseDown}
              onBitMouseEnter={handleBitMouseEnter}
              signals={signals}
              messageName={messageName}
              onSignalClick={handleSignalClick}
            />
          );
        })}
      </div>

      {showModal && selectionStart && selectionEnd && (
        <SignalModal
          frameId={selectionStart.frameId}
          startBit={selectionStart.bitIndex}
          endBit={selectionEnd.bitIndex}
          onSave={handleSaveSignal}
          onCancel={handleCancelModal}
        />
      )}

      {graphSignal && graphFrameId && (
        <SignalGraphModal
          signal={graphSignal}
          frameId={graphFrameId}
          dataHistory={signalHistoryRef.current.get(`${graphFrameId}:${graphSignal.name}`) || []}
          onClose={handleCloseGraph}
        />
      )}
    </div>
  );
}
