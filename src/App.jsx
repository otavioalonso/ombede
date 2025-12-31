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
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#120776ff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
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
            <tr><td>{`${dataPoint.gear ? `Gear ${dataPoint.gear}` : 'N/A'}`}</td><td>{`${dataPoint.rpm ? `${dataPoint.rpm.toFixed(0)} RPM` : 'N/A'}`}</td></tr>
            <tr><td>{`${dataPoint.rpmDown ? `${dataPoint.rpmDown} DOWN` : 'N/A'}`}</td><td>{`${dataPoint.rpmUp ? `${dataPoint.rpmUp} UP` : 'N/A'}`}</td></tr>
            <tr><td>{`${dataPoint.speed ? `${dataPoint.speed.toFixed(0)} km/h` : 'N/A'}`}</td><td>{`${dataPoint.steeringAngle ? `${dataPoint.steeringAngle.toFixed(0)}°` : 'N/A'}`}</td></tr>
            <tr><td>Tank</td><td>{`${dataPoint.fuelLevel ? `${(dataPoint.fuelLevel * 51/100).toFixed(1)} L` : 'N/A'}`}</td></tr>
            <tr><td>Injected</td><td>{`${dataPoint.totalFuelConsumption ? `${dataPoint.totalFuelConsumption.toFixed(0)} mL` : 'N/A'}`}</td></tr>
            <tr><td>Odometer</td><td>{`${dataPoint.odometer ?? 'N/A'} km`}</td></tr>
            <tr><td>Battery</td><td>{`${dataPoint.batteryCharge && dataPoint.batteryCapacity ?
              `${dataPoint.batteryCharge}% × ${dataPoint.batteryCapacity} Ah` : 'N/A'}`}</td></tr>
          </tbody>
        </table>
      ) : (
        <div>Waiting for CAN data...</div>
      )}
    </div>
  );
}

export default App;