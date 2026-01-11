
import { useEffect, useState } from 'react';

import './App.css';
import RpmBar from './RpmBar';
import FuelBar from './FuelBar';
import SteeringArc from './SteeringArc';

function useCANWebSocket(onData) {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3002');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'canData') {
        onData(data.payload.at(-1));
      }
    };
    return () => ws.close();
  }, [onData]);
}



function App() {
  const [dataPoint, setDataPoint] = useState(null);
  const [initialFuelLevel, setInitialFuelLevel] = useState(null);

  useCANWebSocket((dataPoint) => {
    setDataPoint(dataPoint);
    // Capture initial fuel level on first data point
    if (initialFuelLevel === null && dataPoint.fuelLevel) {
      setInitialFuelLevel(dataPoint.fuelLevel);
    }
  });

  return (
    <div className="can-dashboard-bg">
      <main className="can-dashboard-main">
        {dataPoint ? (
          <section className="can-dashboard-card fullscreen-card">
            <RpmBar 
              rpm={dataPoint.rpm || 0} 
              rpmUp={dataPoint.rpmUp || 0} 
              rpmDown={dataPoint.rpmDown || 0} 
            />
            <FuelBar
              fuelLevel={dataPoint.fuelLevel || 0}
              ethanolContent={dataPoint.ethanolContent || 0}
              totalFuelConsumption={dataPoint.totalFuelConsumption || 0}
              initialFuelLevel={initialFuelLevel || dataPoint.fuelLevel || 0}
            />
            <SteeringArc
              steeringAngle={dataPoint.steeringAngle || 0}
              turningRadius={dataPoint.turningRadius}
              maxSteeringAngle={dataPoint.maxSteeringAngle || 30}
            />
            <div className="can-dashboard-grid">
              {/* Row 1: Speed | Gear | Tank */}
              <div className="can-metric speed">
                <div className="can-metric-value big speed">{dataPoint.speed ? dataPoint.speed.toFixed(0) : '--'}</div>
                <div className="can-metric-label">Speed (km/h)</div>
              </div>
              <div className="can-metric gear">
                <div className="can-metric-value big gear">{dataPoint.gear ? dataPoint.gear : '--'}</div>
                <div className="can-metric-label">Gear</div>
              </div>
              <div className="can-metric tank">
                <div className="can-metric-value regular tank">{dataPoint.fuelLevel ? (dataPoint.fuelLevel * 51/100).toFixed(1) : '--'}</div>
                <div className="can-metric-label">Tank (L)</div>
              </div>
              {/* Row 2: Injected | Battery | Ethanol */}
              <div className="can-metric injected">
                <div className="can-metric-value regular injected">{dataPoint.totalFuelConsumption ? Number(dataPoint.totalFuelConsumption.toFixed(0)).toLocaleString() : '--'}</div>
                <div className="can-metric-label">Injected (mL)</div>
              </div>
              <div className="can-metric battery">
                <div className="can-metric-value regular battery">{dataPoint.batteryCharge && dataPoint.batteryCapacity ? `${dataPoint.batteryCharge}%` : '--'}</div>
                <div className="can-metric-label">Battery {dataPoint.batteryCapacity ? `(${dataPoint.batteryCapacity} Ah)` : ''}</div>
              </div>
              <div className="can-metric ethanol">
                <div className="can-metric-value regular ethanol">{dataPoint.ethanolContent ? `${dataPoint.ethanolContent.toFixed(0)}%` : '--'}</div>
                <div className="can-metric-label">Ethanol</div>
              </div>
            </div>
          </section>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            color: '#607d8b',
            fontSize: '1.3rem',
            width: '100%',
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginBottom: 16}}>
              <circle cx="24" cy="24" r="20" stroke="#b0bec5" strokeWidth="4" fill="#eceff1" />
              <path d="M24 12v8" stroke="#90caf9" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="24" cy="32" r="2.5" fill="#90caf9" />
            </svg>
            Waiting for CAN data...
          </div>
        )}
      </main>
    </div>
  );
}

export default App;