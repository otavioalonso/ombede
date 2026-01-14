import { useEffect, useState, useCallback, useRef } from 'react';

import SignalGraph from './SignalGraph';
import SignalModal from './SignalModal';

import { bigEndianStartBit } from '../../server/utils.js';

import './Analyzer.css';


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

function globalBitIndex(byteIndex, bitIndex) {
  return byteIndex * 8 + bitIndex;
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
  const start = bigEndianStartBit(signal.start_bit);
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
function BitSquare({ value, isSelected, isFaded, onMouseDown, onMouseEnter }) {
  let className = `bit-square ${value ? 'filled' : 'empty'}`;
  if (isSelected) className += ' selected';
  if (isFaded) className += ' faded';
  return (
    <div
      className={className}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    />
  );
}

// Byte group component (8 bits)
function ByteGroup({ byteIndex, bits, selectedBits, fadedBits, onBitMouseDown, onBitMouseEnter }) {
  return (
    <div className="byte-group">
      <div className="byte-bits">
        {bits.map((bit, bitIndex) => {
          const gbi = globalBitIndex(byteIndex,  bitIndex);
          return (
            <BitSquare
              key={bitIndex}
              value={bit === '1'}
              isSelected={selectedBits.has(gbi)}
              isFaded={fadedBits.has(gbi)}
              onMouseDown={() => onBitMouseDown(gbi)}
              onMouseEnter={() => onBitMouseEnter(gbi)}
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
  onSignalClick,
  hoveredSignal,
  setHoveredSignal
}) {
  const bits = bytesToBits(bytes);
  
  const fadedBits = new Set(lastChangeTime.map((time, i) => ({i:i, time:time})).filter(({i,time}) => {
    // Fade if some signal is being hovered over and it's not this one 
    if (hoveredSignal) {
      if (hoveredSignal.frameId === frameId){
        const start = bigEndianStartBit(hoveredSignal.start_bit);
        return (i < start) || (i >= start + hoveredSignal.bit_length);
      } else return true;
    }
    
    // Fade if fading by time is enabled 
    if (fadeEnabled) return (currentTime - time) > 1000;

    // Do not fade otherwise
    return false;
  }).map(({i,time}) => i));

  // Group bits by byte
  const byteGroups = [];
  for (let i = 0; i < 8; i++) {
    byteGroups.push({
      byteIndex: i,
      bits: bits.slice(i * 8, (i + 1) * 8),
    });
  }

  // Find signals that apply to this frame and decode their values
  const frameSignals = signals.filter(s => s.frameId === frameId);

  // Format signal value for display
  const formatValue = (value, signal) => {
    if (value === null || value === undefined) return '?';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  };

  return (
    <div className={`can-message-row`}>
      <div className="frame-id">
        0x{frameId.toString(16).toUpperCase().padStart(3, '0')}&nbsp;{frameId.toString().padStart(4)}
      </div>
      <div className="frame-bytes">
        {byteGroups.map((group) => (
          <ByteGroup
            key={group.byteIndex}
            byteIndex={group.byteIndex}
            bits={group.bits}
            selectedBits={selectedBits.get(frameId) || new Set()}
            fadedBits={fadedBits}
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
              title={`Click to see graph. Bits ${bigEndianStartBit(s.start_bit)}-${bigEndianStartBit(s.start_bit) + s.bit_length - 1}`}
              onMouseEnter={() => { setHoveredSignal({ ...s, frameId }); }}
              onMouseLeave={() => { setHoveredSignal(null); }}
              onClick={() => onSignalClick(s, frameId)}
            >
              <span className="signal-name">{s.name}</span>
              <span className="signal-value">{formatValue(value, s)} {s.unit || ''}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Signals() {
  // State for all received frames: Map<frameId, { bytes, lastChangeTime[] }>
  const [frames, setFrames] = useState(new Map());
  const [fadeEnabled, setFadeEnabled] = useState(false); // enable fading
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null); // { frameId, bitIndex }
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedBits, setSelectedBits] = useState(new Map()); // Map<frameId, Set<bitIndex>>
  const [showModal, setShowModal] = useState(false);
  const [signals, setSignals] = useState([]);
  const [lexiconFile, setLexiconFile] = useState('lexicon.json');
  
  // Signal graph state
  const [graphSignal, setGraphSignal] = useState(null);
  const [graphFrameId, setGraphFrameId] = useState(null);
  const signalHistoryRef = useRef(new Map()); // Map<"frameId:signalName", Array<{time, value}>>

  // Global hovered signal state
  const [hoveredSignal, setHoveredSignal] = useState(null);

  // Update current time
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
            Fade inactive bits
          </label>
          <label>
            File:
            <input 
              type="text" 
              value={lexiconFile}
              onChange={(e) => setLexiconFile(e.target.value)}
              placeholder="lexicon.json"
            />
          </label>
        </div>
      </header>
      <div className="signals-list">
        {sortedFrames.map(([frameId, frameData]) => {
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
              onSignalClick={handleSignalClick}
              hoveredSignal={hoveredSignal}
              setHoveredSignal={setHoveredSignal}
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
        <SignalGraph
          signal={graphSignal}
          frameId={graphFrameId}
          dataHistory={signalHistoryRef.current.get(`${graphFrameId}:${graphSignal.name}`) || []}
          onClose={handleCloseGraph}
        />
      )}
    </div>
  );
}
