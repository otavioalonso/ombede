import numpy as np
import pint, obd, time, json

# obd.logger.setLevel(obd.logging.DEBUG)

# u = pint.UnitRegistry(autoconvert_offset_to_baseunit=True)
u = obd.Unit
u.define('percent = ratio / 100 = %')

class Ombede:

    GEAR_RADII = {
        0: 0.0  * u.cm,
        1: 10.0 * u.cm,
        2: 18.0 * u.cm,
        3: 28.5 * u.cm,
        4: 40.0 * u.cm,
        5: 50.0 * u.cm,
    }

    ENGINE_DISPLACEMENT = 1.0 * u.l
    VOLUMETRIC_EFFICIENCY = 0.75

    # Provisory fake data if no connection is found
    USE_FAKE_DATA = True
    default_params = {
        "COOLANT_TEMP":             u.Quantity(96.0,   u.celsius),
        "CATALYST_TEMP_B1S1":       u.Quantity(466.29, u.celsius),
        "INTAKE_TEMP":              u.Quantity(40.0,   u.celsius),
        "INTAKE_PRESSURE":          23.0   * u.kPa,
        "RPM":                      2222.0 / u.min,
        "SPEED":                    38.0   * u.km/u.hour,
        "DISTANCE_SINCE_DTC_CLEAR": 3676.0 * u.km,
        "TIMING_ADVANCE":           16.0   * u.deg,
        "FUEL_LEVEL":               100.0  * u.percent,
        "ABSOLUTE_LOAD":            13.72  * u.percent,
        "COMMANDED_EQUIV_RATIO":    0.8999 * u.ratio,
        "THROTTLE_ACTUATOR":        9.80   * u.percent,
        'ETHANOL_PERCENT':          25.0   * u.percent,
    }

    dependencies = {
        'GEAR_RADIUS': ['SPEED', 'RPM'],
        'GEAR': ['GEAR_RADIUS'],
        'MAF_A': ['ABSOLUTE_LOAD', 'RPM'],
        'MAF_B': ['INTAKE_PRESSURE', 'INTAKE_TEMP', 'RPM'],
        'AFR': ['COMMANDED_EQUIV_RATIO', 'ETHANOL_PERCENT'],
        'FUEL_FLOW': ['AFR', 'MAF_A'],
        'FUEL_EFFICIENCY': ['SPEED', 'FUEL_FLOW'],
    }

    data = {}
    data_log = []
    connection = None

    def __init__(self, connection=None):
        if connection != None and connection.is_connected():
            self.connection = connection

    def _solve_dependencies(self, quant, level=np.inf):
        """ Replace quantity in list by its dependency tree """
        if quant in self.dependencies.keys() and level > 0:
            return [[self._solve_dependencies(d,level=level-2) for d in self.dependencies[dep]] if (dep in self.dependencies.keys() and level > 1) else dep for dep in self.dependencies[quant]]
        else:
            return quant

    def _flatten(self, x):
        """ Flatten irregular list of lists """
        if type(x) == list:
            return [a for i in x for a in self._flatten(i)]
        else:
            return [x]

    def get_dependencies(self, quantities, level=np.inf):
        """ Return flat list of unique dependencies.
            The deepest level np.inf corresponds to quantities to be read from the OBD interface. """
        return list(set(self._flatten([self._solve_dependencies(q, level=level) for q in quantities])))

    def request(self, quantities):
        if type(quantities == str):
            quantities == [quantities]

        # Get data from OBD interface
        if self.USE_FAKE_DATA and self.connection == None:
            print("No connection found. Using fake data.")
            self.data = {k:self.default_params[k] for k in self.get_dependencies(quantities)}
        elif self.connection != None:
            self.data = {k:self.connection.query(obd.commands[k]).value for k in self.get_dependencies(quantities)}
        else:
            print("No connection found. Can't get any data.")
            return

        try:
            # Compute quantities from lower to higher in the dependency tree levels
            for level in np.arange(3,-1,-1):
                self.compute_quantities(self.get_dependencies(quantities, level=level))

            self.data_log.append(self.data)

            return {k:self.data[k] for k in quantities}
        except TypeError:
            print("TypeError: can't compute quantities. Probably an error gathering data.")
            return

    def compute_quantities(self, quantities):

        if 'GEAR_RADIUS' in quantities:
            self.compute_gear_radius()

        if 'GEAR' in quantities:
            self.compute_gear()

        if 'MAF_A' in quantities:
            self.compute_maf_a()

        if 'MAF_B' in quantities:
            self.compute_maf_b()

        if 'AFR' in quantities:
            self.compute_afr()

        if 'FUEL_FLOW' in quantities:
            self.compute_fuel_flow()

        if 'FUEL_EFFICIENCY' in quantities:
            self.compute_fuel_efficiency()

    def compute_gear_radius(self):
        self.data['GEAR_RADIUS'] = (self.data['SPEED']/self.data['RPM']).to(u.cm)

    def compute_gear(self):
        diff = 100.*u.cm
        self.data['GEAR'] = None
        for k in self.GEAR_RADII.keys():
            new_diff = np.abs(self.GEAR_RADII[k] - self.data['GEAR_RADIUS'])
            if  new_diff < diff:
                diff = new_diff
                self.data['GEAR'] = k

    def compute_maf_a(self):
        # mass_air_flow [g/s] = 1.184 [g/l] * displacement [l/intake stroke] * load_abs * engine_speed [r/min] / 2 [r/intake stroke] / 60 [sec/min]
        self.data['MAF_A'] = ((1.184 * u.g/u.l) * self.ENGINE_DISPLACEMENT * self.data['ABSOLUTE_LOAD'] * self.data['RPM'] / 2).to('g/s')

    def compute_maf_b(self):
        # MAF [g/s] = (intake pressure/intake temp) * (molecular mass of air/gas constant for air) * (RPM/60) * (engine displacement/2) * volumetric efficiency
        self.data['MAF_B'] = (self.data['INTAKE_PRESSURE'] / self.data['INTAKE_TEMP'].to('kelvin') * ((28.97 * u.g/u.mol)/(8.3144598 * u.joules/u.K/u.mol)) * self.data['RPM'] * self.ENGINE_DISPLACEMENT/2 * self.VOLUMETRIC_EFFICIENCY).to('g/s')

    def compute_afr(self):
        # for now, assuming commanded EQ = actual
        self.data['AFR'] = (u.g/u.ml * (14.7  + (9.0  - 14.7) * self.data['ETHANOL_PERCENT']) * self.data['COMMANDED_EQUIV_RATIO']).to('g/ml')

    def compute_fuel_flow(self):
        self.data['FUEL_FLOW'] = (self.data['MAF_A'] / self.data['AFR'] / 0.800).to('l/hour')

    def compute_fuel_efficiency(self):
        self.data['FUEL_EFFICIENCY'] = (self.data['SPEED'] / self.data['FUEL_FLOW']).to('km/l')

    def dump(self, filename):
        with open(filename, 'w') as file:
            json.dump([{k: d[k].magnitude for k in d.keys()} for d in self.data_log], file)


if __name__ == '__main__':
    ombe = Ombede(obd.OBD('/dev/rfcomm0'))

    while True:
        try:
            print()

            result = ombe.request(['RPM', 'SPEED', 'ETHANOL_PERCENT', 'AFR', 'FUEL_FLOW', 'FUEL_EFFICIENCY'])

            if result is None:
                time.sleep(1)
            else:
                for k in result.keys():
                    print(f'{k:>20}: {result[k]}')

            if ombe.connection is None:
                time.sleep(1)
                # break

        except KeyboardInterrupt:
            print()
            print('Interrupted.')
            break

    if ombe.connection != None and ombe.connection.is_connected():
        ombe.connection.close()

    ombe.dump(f'data-{time.time():.0f}.txt')


