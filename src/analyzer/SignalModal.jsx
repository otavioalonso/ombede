import { useState } from 'react';
import './SignalModal.css';

import { bigEndianStartBit } from '../../server/utils';

// Signal definition modal
export default function SignalModal({ frameId, startBit, endBit, onSave, onCancel }) {
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
      start_bit: bigEndianStartBit(actualStartBit),
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