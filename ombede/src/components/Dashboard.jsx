
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Gauge from "./Gauge.jsx";
import FuelGauge from "./FuelGauge.jsx";
import AverageGauge from "./AverageGauge.jsx";

const socket = io("http://localhost:3000");

function Dashboard() {
  const [rpm, setRpm] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [ethanol, setEthanol] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(null);
  const [fuelFlow, setFuelFlow] = useState(null);
  const [gear, setGear] = useState(null);
  const [fuelEfficiency, setFuelEfficiency] = useState(null);

  useEffect(() => {
    socket.on("obd-data", (data) => {
      if (data.RPM !== undefined) setRpm(data.RPM);
      if (data.SPEED !== undefined) setSpeed(data.SPEED);
      if (data.ETHANOL_PERCENT !== undefined) setEthanol(data.ETHANOL_PERCENT);
      if (data.FUEL_LEVEL !== undefined) setFuelLevel(data.FUEL_LEVEL);
      if (data.FUEL_FLOW !== undefined) setFuelFlow(data.FUEL_FLOW);
      if (data.GEAR !== undefined) setGear(data.GEAR);
      if (data.FUEL_EFFICIENCY !== undefined) setFuelEfficiency(data.FUEL_EFFICIENCY);

      // console.log("Received data:", data);
    });
    return () => socket.off("obd-data");
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#222", width: "100vw", maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <h2 style={{ marginBottom: 24 }}>Dashboard</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: 0 }}>
        <Gauge value={speed} min={0} max={160} label="km/h" color="#1976d2" />
        <Gauge value={rpm/100} min={0} max={60} label="RPM" color="#d32f2f" />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 0 }}>
        <AverageGauge value={speed} now={Date.now()} hour={10} dt={0.1} format={v => Math.round(v)} tick_interval={0}/>
        <AverageGauge value={fuelEfficiency} now={Date.now()} domain={[0,30]} instant_speed={true} unit="km/ℓ" hour={10} dt={0.1} format={v => Math.round(v)} tick_interval={0}/>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 0 }}>
        <FuelGauge level={fuelLevel} ethanol={ethanol} maxCapacity={51} colorGas="#f93535ff" colorEthanol="rgba(70, 184, 75, 1)" colorText="#666" />
      </div>
      <div style={{ marginTop: 32, width: "100%", textAlign: "center"}}>
        <div><strong>Gear:</strong> {gear !== null ? `${gear}` : "Loading..."}</div>
      </div>
    </div>
  );
}

export default Dashboard;