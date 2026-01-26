import { useEffect, useState, useCallback, useRef } from 'react';

import SignalGraph from './SignalGraph';

import { bigEndianStartBit } from '../../server/utils.js';

import './Analyzer.css';

// TODO: * implement little-endian
//       * implement signed

// Color palette for signals
const SIGNAL_COLORS = [
  '#2ca0ffff',
  '#48bb78',
  '#ff009dff',
  '#ecc94b',
  '#ff0000ff',
  '#9763f1ff',
  '#ff6600ff',
];

// Get a consistent color for a signal based on its name
function getSignalColor(signalName, index) {
  // Use index for consistent coloring within a frame
  return SIGNAL_COLORS[index % SIGNAL_COLORS.length];
}

// WebSocket hook for raw CAN frames
function useRawCANWebSocket(onFrame) {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3003');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'rawFrame') {
        data.payload.map(d => onFrame(d));
        // onFrame(data.payload);
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
function BitSquare({ value, isSelected, isFaded, signalColor, onMouseDown, onMouseEnter }) {
  let className = `bit-square ${value ? 'filled' : 'empty'}`;
  if (isSelected) className += ' selected';
  if (isFaded) className += ' faded';
  if (signalColor) className += ' has-signal';
  
  const style = signalColor ? { 
    '--signal-color': signalColor,
    borderColor: signalColor,
  } : {};
  
  return (
    <div
      className={className}
      style={style}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    />
  );
}

// Byte group component (8 bits)
function ByteGroup({ byteIndex, bits, selectedBits, fadedBits, signalColorMap, onBitMouseDown, onBitMouseEnter }) {
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
              signalColor={signalColorMap.get(gbi)}
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
  fadeDecyphered,
  fadeUndecyphered,
  showSignalColors,
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
  
  // Find signals that apply to this frame
  const frameSignals = signals.filter(s => s.frameId === frameId);
  
  // Build a map of bit index -> signal color (only if colors enabled)
  const signalColorMap = new Map();
  if (showSignalColors) {
    frameSignals.forEach((s, signalIndex) => {
      const color = getSignalColor(s.name, signalIndex);
      const start = bigEndianStartBit(s.start_bit);
      for (let i = 0; i < s.bit_length; i++) {
        signalColorMap.set(start + i, color);
      }
    });
  }
  
  // Helper to check if a bit index is covered by any signal
  const isBitDecyphered = (bitIndex) => {
    return frameSignals.some(s => {
      const start = bigEndianStartBit(s.start_bit);
      return bitIndex >= start && bitIndex < start + s.bit_length;
    });
  };

  const fadedBits = new Set(lastChangeTime.map((time, i) => ({i:i, time:time})).filter(({i,time}) => {
    // Fade if some signal is being hovered over and it's not this one 
    if (hoveredSignal) {
      if (hoveredSignal.frameId === frameId){
        const start = bigEndianStartBit(hoveredSignal.start_bit);
        return (i < start) || (i >= start + hoveredSignal.bit_length);
      } else return true;
    }
    
    // Fade decyphered/undecyphered bits
    const decyphered = isBitDecyphered(i);
    if (fadeDecyphered && decyphered) return true;
    if (fadeUndecyphered && !decyphered) return true;
    
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
            signalColorMap={signalColorMap}
            onBitMouseDown={(bitIdx) => onBitMouseDown(frameId, bitIdx)}
            onBitMouseEnter={(bitIdx) => onBitMouseEnter(frameId, bitIdx)}
          />
        ))}
      </div>
      <div className="frame-signals">
        {frameSignals.map((s, i) => {
          const value = decodeSignal(bytes, s);
          const color = showSignalColors ? getSignalColor(s.name, i) : null;
          return (
            <span 
              key={i} 
              className="signal-badge" 
              style={color ? { '--signal-color': color } : {}}
              title={`Click to see graph. Bits ${bigEndianStartBit(s.start_bit)}-${bigEndianStartBit(s.start_bit) + s.bit_length - 1}`}
              onMouseEnter={() => { setHoveredSignal({ ...s, frameId }); }}
              onMouseLeave={() => { setHoveredSignal(null); }}
              onClick={() => onSignalClick(s, frameId)}
            >
              {color && <span className="signal-color-dot" style={{ backgroundColor: color }} />}
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
  const [fadeEnabled, setFadeEnabled] = useState(false);
  const [fadeDecyphered, setFadeDecyphered] = useState(false);
  const [fadeUndecyphered, setFadeUndecyphered] = useState(false);
  const [showSignalColors, setShowSignalColors] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedBits, setSelectedBits] = useState(new Map());
  const [signals, setSignals] = useState([]);
  const [lexiconFile, setLexiconFile] = useState('lexicon.json');
  const [editingBitRange, setEditingBitRange] = useState(null); // { signal, frameId } when editing bit range
  
  // Undo/Redo state
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const isUndoRedoRef = useRef(false); // Flag to prevent recording during undo/redo
  
  // Signal graph state
  const [graphSignal, setGraphSignal] = useState(null);
  const [graphFrameId, setGraphFrameId] = useState(null);
  const signalHistoryRef = useRef(new Map());

  // Global hovered signal state
  const [hoveredSignal, setHoveredSignal] = useState(null);

  // Push current state to undo stack before making changes
  const pushToUndoStack = useCallback((currentSignals) => {
    if (isUndoRedoRef.current) return; // Don't record during undo/redo
    setUndoStack(prev => [...prev.slice(-49), JSON.parse(JSON.stringify(currentSignals))]); // Keep last 50 states
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Undo last action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    isUndoRedoRef.current = true;
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(signals))]);
    setUndoStack(prev => prev.slice(0, -1));
    setSignals(previousState);
    
    // Sync with server
    syncSignalsToServer(previousState);
    isUndoRedoRef.current = false;
  }, [undoStack, signals]);

  // Redo last undone action
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    isUndoRedoRef.current = true;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(signals))]);
    setRedoStack(prev => prev.slice(0, -1));
    setSignals(nextState);
    
    // Sync with server
    syncSignalsToServer(nextState);
    isUndoRedoRef.current = false;
  }, [redoStack, signals]);

  // Sync signals state to server (rebuild the lexicon file)
  const syncSignalsToServer = async (signalsState) => {
    try {
      await fetch(`/api/signals/sync?file=${encodeURIComponent(lexiconFile)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: signalsState }),
      });
    } catch (error) {
      console.error('Error syncing signals:', error);
    }
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

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
    // Also include the currently open graph signal to show data immediately
    const signalsForFrame = signals.filter(s => s.frameId === frame.id);
    if (graphSignal && graphFrameId === frame.id && !signalsForFrame.find(s => s.name === graphSignal.name)) {
      signalsForFrame.push(graphSignal);
    }
    
    signalsForFrame.forEach(signal => {
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
  }, [signals, graphSignal, graphFrameId]);

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
      // Check if we're editing an existing signal's bit range
      if (editingBitRange) {
        handleUpdateBitRange();
      } else {
        // Create new signal and open modal
        handleCreateSignal();
      }
    }
    setIsSelecting(false);
  };

  // Create a new signal and open the graph modal
  const handleCreateSignal = async () => {
    const bitLength = Math.abs(selectionEnd.bitIndex - selectionStart.bitIndex) + 1;
    const actualStartBit = Math.min(selectionStart.bitIndex, selectionEnd.bitIndex);
    const frameId = selectionStart.frameId;
    
    const newSignal = {
      name: `signal_${frameId}_${actualStartBit}`,
      start_bit: bigEndianStartBit(actualStartBit),
      bit_length: bitLength,
      factor: 1,
      offset: 0,
      unit: '',
      is_big_endian: true,
      is_float: false,
      is_signed: false,
    };
    
    try {
      const response = await fetch(`/api/signals?file=${encodeURIComponent(lexiconFile)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameId, signal: newSignal }),
      });
      
      if (response.ok) {
        const savedSignal = { ...newSignal, frameId };
        pushToUndoStack(signals); // Save state before change
        setSignals(prev => [...prev, savedSignal]);
        setGraphSignal(savedSignal);
        setGraphFrameId(frameId);
        setSelectedBits(new Map());
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    } catch (error) {
      console.error('Error creating signal:', error);
    }
  };

  // Open graph modal when clicking on existing signal
  const handleSignalClick = (signal, frameId) => {
    setGraphSignal(signal);
    setGraphFrameId(frameId);
  };

  // Close graph modal
  const handleCloseGraph = () => {
    setGraphSignal(null);
    setGraphFrameId(null);
    setEditingBitRange(null);
  };

  // Start editing bit range - close modal and let user select new range
  const handleEditBitRange = (signal, frameId) => {
    setGraphSignal(null);
    setGraphFrameId(null);
    setEditingBitRange({ signal, frameId });
  };

  // Update bit range after user selects new range
  const handleUpdateBitRange = async () => {
    if (!editingBitRange || !selectionStart || !selectionEnd) return;
    
    const { signal: oldSignal, frameId: oldFrameId } = editingBitRange;
    const bitLength = Math.abs(selectionEnd.bitIndex - selectionStart.bitIndex) + 1;
    const actualStartBit = Math.min(selectionStart.bitIndex, selectionEnd.bitIndex);
    
    try {
      const response = await fetch(`/api/signals?file=${encodeURIComponent(lexiconFile)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameId: oldFrameId,
          signalName: oldSignal.name,
          updates: {
            start_bit: bigEndianStartBit(actualStartBit),
            bit_length: bitLength,
          },
        }),
      });
      
      if (response.ok) {
        const updatedSignal = {
          ...oldSignal,
          start_bit: bigEndianStartBit(actualStartBit),
          bit_length: bitLength,
        };
        
        pushToUndoStack(signals); // Save state before change
        setSignals(prev => prev.map(s => 
          s.name === oldSignal.name && s.frameId === oldFrameId ? updatedSignal : s
        ));
        
        setSelectedBits(new Map());
        setSelectionStart(null);
        setSelectionEnd(null);
        setGraphSignal(updatedSignal);
        setGraphFrameId(oldFrameId);
        setEditingBitRange(null);
      }
    } catch (error) {
      console.error('Error updating bit range:', error);
    }
  };

  // Delete signal
  const handleDeleteSignal = async (signal, frameId) => {
    try {
      const response = await fetch(`/api/signals?file=${encodeURIComponent(lexiconFile)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameId, signalName: signal.name }),
      });
      
      if (response.ok) {
        pushToUndoStack(signals); // Save state before change
        setSignals(prev => prev.filter(s => !(s.name === signal.name && s.frameId === frameId)));
        setGraphSignal(null);
        setGraphFrameId(null);
        signalHistoryRef.current.delete(`${frameId}:${signal.name}`);
      }
    } catch (error) {
      console.error('Error deleting signal:', error);
    }
  };

  // Update signal (name, factor, offset, unit)
  const handleUpdateSignal = async (updatedSignal) => {
    try {
      const response = await fetch(`/api/signals?file=${encodeURIComponent(lexiconFile)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameId: graphFrameId,
          signalName: graphSignal.name,
          updates: {
            name: updatedSignal.name,
            factor: updatedSignal.factor,
            offset: updatedSignal.offset,
            unit: updatedSignal.unit,
          },
        }),
      });
      
      if (response.ok) {
        // Update history key if name changed
        if (updatedSignal.name !== graphSignal.name) {
          const oldKey = `${graphFrameId}:${graphSignal.name}`;
          const newKey = `${graphFrameId}:${updatedSignal.name}`;
          const history = signalHistoryRef.current.get(oldKey);
          if (history) {
            signalHistoryRef.current.set(newKey, history);
            signalHistoryRef.current.delete(oldKey);
          }
        }
        
        pushToUndoStack(signals); // Save state before change
        setSignals(prev => prev.map(s => 
          s.name === graphSignal.name && s.frameId === graphFrameId
            ? { ...s, ...updatedSignal }
            : s
        ));
        setGraphSignal({ ...graphSignal, ...updatedSignal });
      }
    } catch (error) {
      console.error('Error updating signal:', error);
    }
  };

  // Sort frames by ID
  const sortedFrames = Array.from(frames.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="signals-container" onMouseUp={handleMouseUp}>
      <header className="signals-header">
        <h1>CAN Signal Analyzer</h1>
        <div className="controls">
          <div className="undo-redo-buttons">
            <button 
              className="btn-undo" 
              onClick={handleUndo} 
              disabled={undoStack.length === 0}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button 
              className="btn-redo" 
              onClick={handleRedo} 
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↷
            </button>
          </div>
          <button 
            className={`btn-toggle ${!fadeEnabled ? 'active' : ''}`}
            onClick={() => setFadeEnabled(!fadeEnabled)}
            title="Show bits that haven't changed recently"
          >
            <i className={`fa-solid ${!fadeEnabled ? 'fa-eye' : 'fa-eye-slash'}`} />
            Inactive bits
          </button>
          <button 
            className={`btn-toggle ${!fadeDecyphered ? 'active' : ''}`}
            onClick={() => setFadeDecyphered(!fadeDecyphered)}
            title="Show bits covered by signals"
          >
            <i className={`fa-solid ${!fadeDecyphered ? 'fa-eye' : 'fa-eye-slash'}`} />
            Decyphered bits
          </button>
          <button 
            className={`btn-toggle ${!fadeUndecyphered ? 'active' : ''}`}
            onClick={() => setFadeUndecyphered(!fadeUndecyphered)}
            title="Show bits not covered by signals"
          >
            <i className={`fa-solid ${!fadeUndecyphered ? 'fa-eye' : 'fa-eye-slash'}`} />
            Undecyphered bits
          </button>
          <button 
            className={`btn-toggle btn-colors ${showSignalColors ? 'active' : ''}`}
            onClick={() => setShowSignalColors(!showSignalColors)}
            title="Show colored highlights for signal bits"
          >
            Colors
          </button>
          <div className="file-input">
            <span>File:</span>
            <input 
              type="text" 
              value={lexiconFile}
              onChange={(e) => setLexiconFile(e.target.value)}
              placeholder="lexicon.json"
            />
          </div>
        </div>
      </header>
      {editingBitRange && (
        <div className="edit-mode-banner">
          Select a new bit range for "{editingBitRange.signal.name}"
          <button onClick={() => setEditingBitRange(null)}>Cancel</button>
        </div>
      )}
      <div className="bit-index-header">
        <div className="frame-id-spacer" />
        <div className="bit-indices">
          {Array.from({ length: 8 }, (_, byteIdx) => (
            <div key={byteIdx} className="byte-indices">
              {Array.from({ length: 8 }, (_, bitIdx) => (
                <span key={bitIdx} className="bit-index">{byteIdx * 8 + bitIdx}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="signals-list">
        {sortedFrames.map(([frameId, frameData]) => {
          return (
            <CANMessageRow
              key={frameId}
              frameId={frameId}
              bytes={frameData.bytes}
              lastChangeTime={frameData.lastChangeTime}
              fadeEnabled={fadeEnabled}
              fadeDecyphered={fadeDecyphered}
              fadeUndecyphered={fadeUndecyphered}
              showSignalColors={showSignalColors}
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
      {graphSignal && graphFrameId && (
        <SignalGraph
          signal={graphSignal}
          frameId={graphFrameId}
          dataHistory={signalHistoryRef.current.get(`${graphFrameId}:${graphSignal.name}`) || []}
          onClose={handleCloseGraph}
          onEditBitRange={handleEditBitRange}
          onDelete={handleDeleteSignal}
          onUpdate={handleUpdateSignal}
        />
      )}
    </div>
  );
}
