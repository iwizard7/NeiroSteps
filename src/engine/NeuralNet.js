// Pure JavaScript neural network - no TensorFlow needed
// Fast forward-pass only MLP for evolutionary use

export class Brain {
  constructor(inputSize, hiddenSize, outputSize, weights = null) {
    this.inputSize  = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.weights    = weights ?? this._randomWeights();
  }

  _randomWeights() {
    // Xavier-like initialization for tanh/relu to encourage active gradients
    const rand = (rows, cols) =>
      Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (Math.random() * 2 - 1) * 1.5)
      );
    return {
      w1: rand(this.inputSize,  this.hiddenSize),
      b1: Array(this.hiddenSize).fill((Math.random() * 2 - 1) * 0.5),
      w2: rand(this.hiddenSize, this.outputSize),
      b2: Array(this.outputSize).fill((Math.random() * 2 - 1) * 0.5),
    };
  }

  // Fast forward pass with plain arrays - no TF overhead
  predict(inputs) {
    const { w1, b1, w2, b2 } = this.weights;

    // Hidden layer: tanh(W1 * x + b1)
    const h = new Array(this.hiddenSize);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = b1[j];
      for (let i = 0; i < this.inputSize; i++) sum += inputs[i] * w1[i][j];
      h[j] = Math.tanh(sum); // Tanh instead of ReLU to prevent dead neurons in EA
    }

    // Output layer: tanh(W2 * h + b2)
    const out = new Array(this.outputSize);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = b2[k];
      for (let j = 0; j < this.hiddenSize; j++) sum += h[j] * w2[j][k];
      out[k] = Math.tanh(sum);
    }

    return out;
  }

  mutate(rate = 0.1, strength = 0.3) {
    const mutArr = (arr) => arr.map(v =>
      Array.isArray(v)
        ? mutArr(v)
        : (Math.random() < rate ? v + (Math.random() * 2 - 1) * strength : v)
    );
    return new Brain(this.inputSize, this.hiddenSize, this.outputSize, {
      w1: mutArr(this.weights.w1),
      b1: mutArr(this.weights.b1),
      w2: mutArr(this.weights.w2),
      b2: mutArr(this.weights.b2),
    });
  }

  clone() {
    return new Brain(this.inputSize, this.hiddenSize, this.outputSize,
      JSON.parse(JSON.stringify(this.weights)));
  }

  toJSON() {
    return { inputSize: this.inputSize, hiddenSize: this.hiddenSize, outputSize: this.outputSize, weights: this.weights };
  }

  static fromJSON(data) {
    return new Brain(data.inputSize, data.hiddenSize, data.outputSize, data.weights);
  }
}
