
class RunningAverage {
  constructor() {
    this.average = 0;
    this.n = 0;
  }

  update(value) {
    this.n++;
    this.average += (value - this.average) / this.n;
    return this.average;
  }
}

export default RunningAverage;