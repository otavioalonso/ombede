import { useEffect, useState } from 'react'
import './App.css'

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

  useCANWebSocket((dataPoint) => {
    setDataPoint(dataPoint);
  });

  return (
    <div id="can-visualization" style={{ width: '80vw', height: '90vh', margin: 0, padding: 0, fontFamily: 'sans-serif' }}>
      {dataPoint ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f9f9f9', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
          <tbody>
            <tr>
              <td colSpan={2} style={{fontWeight: 'bold'}}>{
                (() => {
                  // If time is a float UNIX timestamp (seconds), convert to ms
                  const t = Number(dataPoint.time);
                  if (!isNaN(t)) {
                    const date = new Date(t * 1000);
                    return date.toLocaleString();
                  }
                  return dataPoint.time;
                })()
              }</td>
            </tr>
            <tr><td>Speed</td><td>{`${dataPoint.speed ? `${dataPoint.speed} km/h` : 'N/A'}`}</td></tr>
            <tr><td>RPM</td><td>{`${dataPoint.rpm ?? 'N/A'}`}</td></tr>
            <tr><td>Throttle Position</td><td>{`${dataPoint.throttlePosition ?? 'N/A'}`}</td></tr>
            <tr><td>Gear</td><td>{`${dataPoint.gear ?? 'N/A'}`}</td></tr>
            <tr><td>Fuel Consumption</td><td>{`${dataPoint.fuelConsumption ? `${dataPoint.fuelConsumption.toFixed(3)} mL` : 'N/A'}`}</td></tr>
            <tr><td>Odometer</td><td>{`${dataPoint.odometer ?? 'N/A'} km`}</td></tr>
            <tr><td>Distance/Rev</td><td>{`${dataPoint.distancePerRevolution ?? 'N/A'}`}</td></tr>
            <tr><td>Reverse</td><td>{dataPoint.reverse ? 'Yes' : 'No'}</td></tr>
            <tr><td>Battery Charge</td><td>{`${dataPoint.batteryCharge ? `${dataPoint.batteryCharge}%` : 'N/A'}`}</td></tr>
            <tr><td>Δ Battery Charge</td><td>{`${dataPoint.deltaBatteryCharge ? `${dataPoint.deltaBatteryCharge.toFixed(3)} Ah` : 'N/A'}`}</td></tr>
            <tr><td>Battery Capacity</td><td>{`${dataPoint.batteryCapacity ? `${dataPoint.batteryCapacity} Ah` : 'N/A'}`}</td></tr>
          </tbody>
        </table>
      ) : (
        <div>Waiting for CAN data...</div>
      )}
    </div>
  );
}

export default App;