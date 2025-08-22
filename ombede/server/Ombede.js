// Ombede.js - Node.js implementation of the Ombede system
// Handles quantities, dependencies, and computation logic

const MOLAR_MASS_AIR = 28.97; // g/mol
const GAS_CONSTANT = 8.3144598; // J/(K*mol)
const FUEL_DENSITY = 0.737; // g/ml
const AIR_DENSITY = 1.184; // g/l

class Ombede {
    constructor(connection = null) {
        this.connection = connection;
        this.USE_FAKE_DATA = true;
        this.data = {};
        this.dataLog = [];
        if (this.USE_FAKE_DATA) {
            this.data = {
                COOLANT_TEMP: 96.0, // Celsius
                CATALYST_TEMP_B1S1: 466.29, // Celsius
                INTAKE_TEMP: 40.0, // Celsius
                INTAKE_PRESSURE: 23.0, // kPa
                RPM: 2222.0, // per min
                SPEED: 30.0, // km/h
                DISTANCE_SINCE_DTC_CLEAR: 3676.0, // km
                TIMING_ADVANCE: 16.0, // deg
                FUEL_LEVEL: 75.0, // percent
                ABSOLUTE_LOAD: 13.72, // percent
                COMMANDED_EQUIV_RATIO: 0.8999, // ratio
                THROTTLE_ACTUATOR: 9.80, // percent
                ETHANOL_PERCENT: 75.0, // percent
            };
        };
        this.dependencies = {
            GEAR_RADIUS: ['SPEED', 'RPM'],
            GEAR: ['DIST_PER_REV'],
            MAF_A: ['ABSOLUTE_LOAD', 'RPM'],
            MAF: ['INTAKE_PRESSURE', 'INTAKE_TEMP', 'RPM'],
            AFR: ['COMMANDED_EQUIV_RATIO', 'ETHANOL_PERCENT'],
            FUEL_FLOW: ['AFR', 'MAF'],
            FUEL_EFFICIENCY: ['SPEED', 'FUEL_FLOW'],
        };

        this.DIST_PER_REV_DICT = {
            0: 0.0,
            1: 10.0,
            2: 18.0,
            3: 28.5,
            4: 40.0,
            5: 50.0,
        };


        this.ENGINE_DISPLACEMENT = 1.0; // liters
        this.VOLUMETRIC_EFFICIENCY = 0.75;
    }

    // Recursively resolve dependencies
    _solveDependencies(quant, level = Infinity) {
        if (this.dependencies[quant] && level > 0) {
            return this.dependencies[quant].map(dep =>
                this.dependencies[dep] && level > 1
                    ? this._solveDependencies(dep, level - 2)
                    : dep
            );
        } else {
            return quant;
        }
    }

    // Flatten nested arrays
    _flatten(x) {
        if (Array.isArray(x)) {
            return x.flatMap(i => this._flatten(i));
        } else {
            return [x];
        }
    }

    // Get unique flat list of dependencies
    getDependencies(quantities, level = Infinity) {
        const deps = quantities.map(q => this._solveDependencies(q, level));
        return [...new Set(this._flatten(deps))];
    }

    // Request quantities and compute them
    request(quantities) {
        this.data['TIME'] = Date.now();
        if (typeof quantities === 'string') quantities = [quantities];
        if (this.USE_FAKE_DATA && !this.connection) {
            // console.log('No connection found. Using fake data.');
                const variation = Math.random() - 0.5;
                this.data['SPEED'] = this.data['SPEED'] + variation; // Simulate speed change
                this.data['INTAKE_PRESSURE'] = this.data['INTAKE_PRESSURE'] + variation;
                if (this.data['INTAKE_PRESSURE'] < 0) this.data['INTAKE_PRESSURE'] = 10;
                if (this.data['SPEED'] < 0) this.data['SPEED'] = 0;

                const gear = Math.ceil(Math.min(this.data['SPEED'] / 15, 5)); // Simulate gear change
                
                this.data['RPM'] = this.data['SPEED'] / 60 * 100000 / this.DIST_PER_REV_DICT[gear] ;

                console.log(this.data);

        } else if (this.connection) {
            // TODO: Implement OBD connection logic
            // this.data = ...
        } else {
            console.log("No connection found. Can't get any data.");
            return;
        }
        try {
            for (let level = 3; level >= 0; level--) {
                this.computeQuantities(this.getDependencies(quantities, level));
            }
            this.dataLog.push({ ...this.data });
            return Object.fromEntries(
                quantities.map(k => [k, this.data[k]])
            );
        } catch (e) {
            console.log("Error computing quantities:", e);
            return;
        }
    }

    // Compute derived quantities
    computeQuantities(quantities) {
        if (quantities.includes('DIST_PER_REV')) this.computeDistPerRev();
        if (quantities.includes('GEAR')) this.computeGear();
        if (quantities.includes('MAF_A')) this.computeMafA();
        if (quantities.includes('MAF')) this.computeMaf();
        if (quantities.includes('AFR')) this.computeAfr();
        if (quantities.includes('FUEL_FLOW')) this.computeFuelFlow();
        if (quantities.includes('FUEL_EFFICIENCY')) this.computeFuelEfficiency();
    }

    computeDistPerRev() {
    // Assume SPEED in km/h, RPM in 1/min, output in cm
    this.data['DIST_PER_REV'] = this.data['SPEED'] / 60 * 100000 / this.data['RPM'];
    }

    computeGear() {
        let diff = 100.0;
        this.data['GEAR'] = null;
        for (const k in this.DIST_PER_REV_DICT) {
            const newDiff = Math.abs(this.DIST_PER_REV_DICT[k] - this.data['DIST_PER_REV']);
            if (newDiff < diff) {
                diff = newDiff;
                this.data['GEAR'] = Number(k);
            }
        }
    }

    computeMafA() {
        this.data['MAF_A'] = AIR_DENSITY * this.ENGINE_DISPLACEMENT * this.data['ABSOLUTE_LOAD'] * (this.data['RPM']/60/2); // g/s
    }
    
    computeMaf() {
        this.data['MAF'] = (this.data['INTAKE_PRESSURE']*1000 / (this.data['INTAKE_TEMP'] + 273.15) * (MOLAR_MASS_AIR / GAS_CONSTANT) * (this.data['RPM']/60/2) * (this.ENGINE_DISPLACEMENT / 1000) * this.VOLUMETRIC_EFFICIENCY);
    }

    computeAfr() {
        this.data['AFR'] = (14.7 + (9.0 - 14.7) * (this.data['ETHANOL_PERCENT']/100.0)) * this.data['COMMANDED_EQUIV_RATIO'];
    }

    computeFuelFlow() {
        this.data['FUEL_FLOW'] = this.data['MAF'] / this.data['AFR'] / FUEL_DENSITY; // ml/s
    }

    computeFuelEfficiency() {
        this.data['FUEL_EFFICIENCY'] = this.data['SPEED'] / this.data['FUEL_FLOW'] / 3.6; // km/l
    }
}

export default Ombede;
