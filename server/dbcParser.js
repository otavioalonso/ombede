// DBC file parser
// Converts DBC format to the internal lexicon JSON format

/**
 * Parse a DBC file content and return a lexicon-compatible object
 * @param {string} content - The DBC file content
 * @returns {object} - Parsed messages and signals in lexicon format
 */
export function parseDbcFile(content) {
  const messages = [];
  const lines = content.split('\n');
  
  let currentMessage = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Parse message definition: BO_ <CAN-ID> <MessageName>: <MessageLength> <Transmitter>
    const messageMatch = line.match(/^BO_\s+(\d+)\s+(\w+)\s*:\s*(\d+)\s+(\w+)/);
    if (messageMatch) {
      currentMessage = {
        id: parseInt(messageMatch[1], 10),
        name: messageMatch[2],
        length: parseInt(messageMatch[3], 10),
        is_extended_frame: false,
        is_fd: false,
        signals: []
      };
      messages.push(currentMessage);
      continue;
    }
    
    // Parse signal definition: SG_ <SignalName> : <StartBit>|<Length>@<ByteOrder><ValueType> (<Factor>,<Offset>) [<Min>|<Max>] "<Unit>" <Receiver>
    // ByteOrder: 0 = big endian (Motorola), 1 = little endian (Intel)
    // ValueType: + = unsigned, - = signed
    const signalMatch = line.match(/^\s*SG_\s+(\w+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^\|]*)\|([^\]]*)\]\s*"([^"]*)"\s*(.*)/);
    if (signalMatch && currentMessage) {
      const startBit = parseInt(signalMatch[2], 10);
      const bitLength = parseInt(signalMatch[3], 10);
      const byteOrder = signalMatch[4]; // 0 = big endian, 1 = little endian
      const valueType = signalMatch[5]; // + = unsigned, - = signed
      const factor = parseFloat(signalMatch[6]);
      const offset = parseFloat(signalMatch[7]);
      const min = parseFloat(signalMatch[8]) || 0;
      const max = parseFloat(signalMatch[9]) || 0;
      const unit = signalMatch[10];
      
      const signal = {
        name: signalMatch[1],
        start_bit: startBit,
        bit_length: bitLength,
        is_big_endian: byteOrder === '0',
        is_signed: valueType === '-',
        is_float: false,
        factor: factor,
        offset: offset,
        unit: unit || '',
        min: min,
        max: max
      };
      
      currentMessage.signals.push(signal);
      continue;
    }
    
    // Parse value descriptions: VAL_ <CAN-ID> <SignalName> <Value1> "<Description1>" <Value2> "<Description2>" ... ;
    const valMatch = line.match(/^VAL_\s+(\d+)\s+(\w+)\s+(.+);$/);
    if (valMatch) {
      const messageId = parseInt(valMatch[1], 10);
      const signalName = valMatch[2];
      const valuesStr = valMatch[3];
      
      // Find the message and signal
      const msg = messages.find(m => m.id === messageId);
      if (msg) {
        const sig = msg.signals.find(s => s.name === signalName);
        if (sig) {
          // Parse value-description pairs
          const valueRegex = /(\d+)\s+"([^"]+)"/g;
          let match;
          sig.states = [];
          while ((match = valueRegex.exec(valuesStr)) !== null) {
            sig.states.push({
              value: parseInt(match[1], 10),
              name: match[2]
            });
          }
        }
      }
      continue;
    }
  }
  
  return { messages };
}

/**
 * Merge imported DBC data with existing lexicon data
 * @param {object} existing - Existing lexicon data
 * @param {object} imported - Imported DBC data
 * @param {string} mode - 'replace' | 'merge' | 'import'
 * @param {number[]} detectedFrameIds - Array of currently detected frame IDs (for merge/append modes)
 * @returns {object} - Merged lexicon data
 */
export function mergeDbcData(existing, imported, mode = 'merge', detectedFrameIds = []) {
  const detectedSet = new Set(detectedFrameIds);
  
  if (mode === 'replace') {
    // Replace all signals with imported ones (including non-detected)
    return imported;
  }
  
  // Build a map of existing messages
  const messagesMap = new Map(existing.messages.map(m => [m.id, { ...m, signals: [...m.signals] }]));
  
  if (mode === 'merge') {
    // Add signals that don't overlap with existing signal bit ranges
    // Only for detected frame IDs
    for (const importedMsg of imported.messages) {
      // Only process detected frame IDs
      if (!detectedSet.has(importedMsg.id)) continue;
      
      if (messagesMap.has(importedMsg.id)) {
        const existingMsg = messagesMap.get(importedMsg.id);
        
        // Build a set of all bits covered by existing signals
        const coveredBits = new Set();
        for (const sig of existingMsg.signals) {
          for (let i = 0; i < sig.bit_length; i++) {
            coveredBits.add(sig.start_bit + i);
          }
        }
        
        // Add imported signals that don't overlap
        for (const importedSig of importedMsg.signals) {
          let overlaps = false;
          for (let i = 0; i < importedSig.bit_length; i++) {
            if (coveredBits.has(importedSig.start_bit + i)) {
              overlaps = true;
              break;
            }
          }
          
          if (!overlaps) {
            existingMsg.signals.push(importedSig);
            // Mark these bits as covered for subsequent signals
            for (let i = 0; i < importedSig.bit_length; i++) {
              coveredBits.add(importedSig.start_bit + i);
            }
          }
        }
        
        // Update message name if it was generic
        if (existingMsg.name.startsWith('message_')) {
          existingMsg.name = importedMsg.name;
        }
      } else {
        // Add new message with all its signals (no existing signals to overlap with)
        messagesMap.set(importedMsg.id, importedMsg);
      }
    }
    
    return {
      messages: Array.from(messagesMap.values()).sort((a, b) => a.id - b.id)
    };
  }
  
  // mode === 'import'
  for (const importedMsg of imported.messages) {
    // Only process detected frame IDs
    if (!detectedSet.has(importedMsg.id)) continue;
    
    if (messagesMap.has(importedMsg.id)) {
      // Merge signals into existing message
      const existingMsg = messagesMap.get(importedMsg.id);
      const existingSignalNames = new Set(existingMsg.signals.map(s => s.name));
      
      for (const sig of importedMsg.signals) {
        if (!existingSignalNames.has(sig.name)) {
          existingMsg.signals.push(sig);
        }
      }
      
      // Update message name if it was generic
      if (existingMsg.name.startsWith('message_')) {
        existingMsg.name = importedMsg.name;
      }
    } else {
      // Add new message
      messagesMap.set(importedMsg.id, importedMsg);
    }
  }
  
  return {
    messages: Array.from(messagesMap.values()).sort((a, b) => a.id - b.id)
  };
}
