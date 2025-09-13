import './Dashboard.css';

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import FuelGauge from "./FuelGauge.jsx";

import SpeedNumbers from "./SpeedNumbers.jsx";
import RunningAverage from "./RunningAverage.jsx";



const socket = io("http://localhost:3000");

function Dashboard() {

  const [rpm, setRpm] = useState(null);
  const [rpmUp, setRpmUp] = useState(null);
  const [rpmDown, setRpmDown] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [ethanol, setEthanol] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(null);
  const [fuelFlow, setFuelFlow] = useState(0);
  const [gear, setGear] = useState(null);
  const [fuelEfficiency, setFuelEfficiency] = useState(0);
  const [fuelEfficiencyAvg, setFuelEfficiencyAvg] = useState(0);
  const [fuelFlowAvg, setFuelFlowAvg] = useState(0);

  const fuelEfficiencyAvgCalculator = new RunningAverage();
  const fuelFlowAvgCalculator = new RunningAverage();

  useEffect(() => {
    socket.on("obd-data", (data) => {
      if (data.RPM !== undefined) setRpm(data.RPM);
      if (data.RPM_UP !== undefined) setRpmUp(data.RPM_UP);
      if (data.RPM_DOWN !== undefined) setRpmDown(data.RPM_DOWN);
      if (data.SPEED !== undefined) setSpeed(data.SPEED);
      if (data.ETHANOL_PERCENT !== undefined) setEthanol(data.ETHANOL_PERCENT);
      if (data.FUEL_LEVEL !== undefined) setFuelLevel(data.FUEL_LEVEL);
      if (data.FUEL_FLOW !== undefined) {
        setFuelFlow(data.FUEL_FLOW);
        setFuelFlowAvg(fuelFlowAvgCalculator.update(data.FUEL_FLOW));
      }
      if (data.GEAR !== undefined) setGear(data.GEAR);
      if (data.FUEL_EFFICIENCY !== undefined) {
        setFuelEfficiency(data.FUEL_EFFICIENCY);
        setFuelEfficiencyAvg(fuelEfficiencyAvgCalculator.update(data.FUEL_EFFICIENCY));
      }

      // console.log("Received data:", data);
    });
    return () => socket.off("obd-data");
  }, []);

  return (
    <div style={{ display: "flex", position: "absolute", backgroundColor: "#eee", width: "640px", height: "360px"}}>
      <div style={{ position: 'absolute', left: '100px', top: '30px' }}>
        <SpeedNumbers speed={speed} gear={gear} rpm={rpm} rpmUp={rpmUp} rpmDown={rpmDown} />
        </div>
      <div style={{ position: 'absolute', right: '0px', top: '30px' }}>
        <FuelGauge level={fuelLevel} ethanol={ethanol} maxCapacity={51} colorGas="#f93535ff" colorEthanol="rgba(70, 184, 75, 1)" colorText="#666" />
        </div>

      <div style={{ position: 'absolute', right: '0px', top: "140px"}}>
        <div style={{ position: 'relative', right: '30px', top: "80px",fontSize: '20px', fontWeight: 'bold', color: '#666', textAlign: 'center' }}>
          km/l
          <span style={{ color: 'white', backgroundColor: fuelEfficiency > fuelEfficiencyAvg ? 'green' : '#f93535ff', padding: "0", borderRadius: '5px', width: '60px', display: 'inline-block', margin: '6px'}}>
            {fuelEfficiency.toFixed(1)}
            </span>
          <span style={{ color: 'white', backgroundColor: '#14aeebff', padding: "0", borderRadius: '50px', width: '60px', display: 'inline-block', textAlign: 'center' }}>
            {fuelEfficiencyAvg.toFixed(1)}
          </span>
        <div style={{ position: 'relative', top: '20px', right: '24px', fontSize: '20px', fontWeight: 'bold', color: '#666', textAlign: 'center' }}>
            
            <span style={{ color: 'white', backgroundColor: '#6206ecf5', padding: "0", borderRadius: '10px', width: '130px', display: 'inline-block' }}>
            <i className="fa fa-gas-pump"/>{(fuelEfficiencyAvg*51*fuelLevel/100).toFixed(0)} km
            </span> &nbsp;
            <span style={{ color: 'white', backgroundColor: '#ff820ef5', padding: "0", borderRadius: '10px', minWidth: '90px', display: 'inline-block'}}>
            <i className="fa fa-clock"/>{fuelFlowAvg > 0 ? (51*fuelLevel/100 / fuelFlowAvg * 1000 / 3600).toFixed(0) : 0} h
            </span>
          </div>
        </div>
      </div>
    </div>
        
        
      /* <div style={{ display: "flex", justifyContent: "center", gap: 0 }}>
        <AverageGauge value={speed} now={Date.now()} hour={10} dt={0.1} format={v => Math.round(v)} tick_interval={0}/>
        <AverageGauge value={fuelEfficiency} now={Date.now()} domain={[0,30]} instant_speed={true} unit="km/ℓ" hour={10} dt={0.1} format={v => Math.round(v)} tick_interval={0}/>
      </div> */
  );
}

export default Dashboard;