
const MAX_DATA_LOG_LENGTH = 10000;

class BaseCalculator {
    constructor() {
        this.data = {};
        this.dataLog = [];
        this.dependencies = {};
    }

    // Recursively solve dependencies
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
        if (typeof quantities === 'string') quantities = [quantities];
        const deps = quantities.map(q => this._solveDependencies(q, level));
        return [...new Set(this._flatten(deps))];
    }

    // Get all quantities that depend on given quantities
    getDependents(quantities) {
        const dependents = new Set();
        const stack = (typeof quantities === 'string') ? [quantities] : quantities;
        for (const [key, deps] of Object.entries(this.dependencies)) {
            for (const dep of this.getDependencies(deps)) {
                if (stack.includes(dep)) dependents.add(key);
            }
        }
        return Array.from(dependents);
    }

    // Request quantities and compute them
    request(quantities) {
        if (typeof quantities === 'string') quantities = [quantities];
        try {
            for (let level = 3; level >= 0; level--) {
                this.computeQuantities(this.getDependencies(quantities, level));
            }
            this.dataLog.push({ ...this.data });
            if (this.dataLog.length > MAX_DATA_LOG_LENGTH) {
                this.dataLog.shift();
            }
            return Object.fromEntries(
                quantities.map(k => [k, this.data[k]])
            );
        } catch (e) {
            console.log("Error computing quantities:", e);
            return;
        }
    }

    update(data, quantities = null) {
        if (quantities == null) {
            quantities = Object.keys(data);
        }
        this.data = { ...this.data, ...data };
        this.computeQuantities(this.getDependents(quantities));
        this.dataLog.push({ ...this.data });
        if (this.dataLog.length > MAX_DATA_LOG_LENGTH) {
            this.dataLog.shift();
        }
        return this.data;
    }

    // To be implemented by subclass
    computeQuantities(quantities) {
        throw new Error('computeQuantities must be implemented by subclass');
    }
}

class KaCalculator extends BaseCalculator {
    constructor() {
        super();
        this.dependencies = {
            distancePerRevolution: ['speed', 'rpm'],
            gear: ['distancePerRevolution'],
            fuelEfficiency: ['speed', 'fuelFlow'],
        };
        this.distancePerRevolutionDict = {
            0: 0.0,
            1: 10.0,
            2: 18.0,
            3: 28.5,
            4: 40.0,
            5: 50.0,
        };
    }

    // Compute derived quantities
    computeQuantities(quantities) {
        if (typeof quantities === 'string') quantities = [quantities];
        if (quantities.includes('distancePerRevolution')) this.computeDistancePerRevolution();
        if (quantities.includes('gear')) this.computeGear();
        // if (quantities.includes('fuelEfficiency')) this.computeFuelEfficiency();
        if (quantities.includes('totalFuelConsumption')) this.computeTotalFuelConsumption();
    }

    computeDistancePerRevolution() {
        // Assume speed in km/h, RPM in 1/min, output in cm
        this.data['distancePerRevolution'] = this.data['speed'] / 60 * 100000 / this.data['rpm'];
    }

    computeGear() {
        let diff = 0.05;
        this.data['gear'] = 0;
        for (const k in this.distancePerRevolutionDict) {
            const newDiff = Math.abs(this.distancePerRevolutionDict[k] - this.data['distancePerRevolution'])/this.distancePerRevolutionDict[k] - 1;
            if (newDiff < diff) {
                diff = newDiff;
                this.data['gear'] = Number(k);
            }
        }
        if (this.data['gear'] != 0) {
            this.data['rpmUp'] = Math.round(this.data['rpm'] * (this.distancePerRevolutionDict[this.data['gear']] / this.distancePerRevolutionDict[this.data['gear'] + 1]));
            this.data['rpmDown'] = Math.round(this.data['rpm'] * (this.distancePerRevolutionDict[this.data['gear']] / this.distancePerRevolutionDict[this.data['gear'] - 1]));
        }
    }
    // fuelConsumption resets to zero once it reaches 25575. We have to make sure totalFuelConsumption is ever increasing.
    computeTotalFuelConsumption() {
        this.data['previousFuelConsumption'] = this.data['previousFuelConsumption'] || 0;

        if (this.data['fuelConsumption'] < this.data['previousFuelConsumption']) {
            this.data['fuelConsumptionCycles'] = (this.data['fuelConsumptionCycles'] || 0) + 1;
        }
        
        this.data['totalFuelConsumption'] = this.data['fuelConsumption'] + (this.data['fuelConsumptionCycles'] || 0) * 25575;
    }
}

export { BaseCalculator, KaCalculator };