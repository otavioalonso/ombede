// Node.js implementation of the Ombede system
// Handles quantities, dependencies, and computation logic

const MolarMassAir = 28.97; // g/mol
const GasConstant = 8.3144598; // J/(K*mol)
const FuelDensity = 0.737; // g/ml
const AirDensity = 1.184; // g/l

class calculator {
    constructor() {
        this.data = {};
        this.dataLog = [];
        this.dependencies = {
            DistPerRev: ['Speed', 'RPM'],
            Gear: ['DistPerRev'],
            MAF_A: ['AbsoluteLoad', 'RPM'],
            MAF: ['IntakePressure', 'IntakeTemp', 'RPM'],
            AFR: ['CommandedEquivRatio', 'EthanolPercent'],
            FuelFlow: ['AFR', 'MAF'],
            FuelEfficiency: ['Speed', 'FuelFlow'],
        };

        this.DistPerRevDict = {
            0: 0.0,
            1: 10.0,
            2: 18.0,
            3: 28.5,
            4: 40.0,
            5: 50.0,
        };

        this.EngineDisplacement = 1.0; // liters
        this.VolumetricEfficiency = 0.75;
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
        this.data['Time'] = Date.now();
        if (typeof quantities === 'string') quantities = [quantities];
        // this.data[...] = ...
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
        if (quantities.includes('DistPerRev')) this.computeDistPerRev();
        if (quantities.includes('Gear')) this.computeGear();
        if (quantities.includes('MAFA')) this.computeMAFA();
        if (quantities.includes('MAF')) this.computeMAF();
        if (quantities.includes('AFR')) this.computeAFR();
        if (quantities.includes('FuelFlow')) this.computeFuelFlow();
        if (quantities.includes('FuelEfficiency')) this.computeFuelEfficiency();
    }

    computeDistPerRev() {
    // Assume Speed in km/h, RPM in 1/min, output in cm
    this.data['DistPerRev'] = this.data['Speed'] / 60 * 100000 / this.data['RPM'];
    }

    computeGear() {
        let diff = 0.05;
        this.data['Gear'] = 0;
        for (const k in this.DistPerRevDict) {
            const newDiff = Math.abs(this.DistPerRevDict[k] - this.data['DistPerRev'])/this.DistPerRevDict[k] - 1;
            if (newDiff < diff) {
                diff = newDiff;
                this.data['Gear'] = Number(k);
            }
        }
        if (this.data['Gear'] != 0) {
            this.data['RPMUp'] = Math.round(this.data['RPM'] * (this.DistPerRevDict[this.data['Gear']] / this.DistPerRevDict[this.data['Gear'] + 1]));
            this.data['RPMDown'] = Math.round(this.data['RPM'] * (this.DistPerRevDict[this.data['Gear']] / this.DistPerRevDict[this.data['Gear'] - 1]));
        }
    }

    computeMAFA() {
        this.data['MAFA'] = AirDensity * this.EngineDisplacement * this.data['AbsoluteLoad'] * (this.data['RPM']/60/2); // g/s
    }
    
    computeMAF() {
        this.data['MAF'] = (this.data['IntakePressure']*1000 / (this.data['IntakeTemp'] + 273.15) * (MolarMassAir / GasConstant) * (this.data['RPM']/60/2) * (this.EngineDisplacement / 1000) * this.VolumetricEfficiency);
    }

    computeAFR() {
        this.data['AFR'] = (14.7 + (9.0 - 14.7) * (this.data['EthanolPercent']/100.0)) * this.data['CommandedEquivRatio'];
    }

    computeFuelFlow() {
        this.data['FuelFlow'] = this.data['MAF'] / this.data['AFR'] / FuelDensity; // ml/s
    }

    computeFuelEfficiency() {
        this.data['FuelEfficiency'] = this.data['Speed'] / this.data['FuelFlow'] / 3.6; // km/l
    }
}

module.exports = calculator;
