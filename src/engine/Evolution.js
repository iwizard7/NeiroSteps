import { Creature } from './Creature';
import { Brain }   from './NeuralNet';

const INPUT_SIZE  = 11;
const HIDDEN_SIZE = 16;
const OUTPUT_SIZE = 4;

export class EvolutionManager {
  constructor(populationSize, physics) {
    this.populationSize = populationSize;
    this.physics        = physics;
    this.generation     = 1;
    this.population     = [];
    this.brains         = [];
    this.bestFitness    = 0;
    this.avgFitness     = 0;
    this.history        = [];
    this.bestSoloFitness = -Infinity;
    this.bestSoloBrain   = null;

    this._initPopulation(null);
  }

  _scoreCreature(creature) {
    const displacement = creature.torso.translation().x - creature.spawnPos.x;
    const backwardPenalty = Math.max(0, -displacement) * 0.8;
    return creature.fitness - backwardPenalty;
  }

  _initPopulation(brains = null) {
    this.population = [];
    this.brains     = [];
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(new Creature(i, this.physics));
      this.brains.push(brains ? brains[i] : new Brain(INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE));
    }
  }

  update() {
    let total = 0;
    let max = -Infinity;
    for (let i = 0; i < this.populationSize; i++) {
      const c = this.population[i];
      if (c.alive) {
        const actions = this.brains[i].predict(c.getInputs());
        c.applyActions(actions);
        c.updateFitness();
      }
      const score = this._scoreCreature(c);
      if (score > max) max = score;
      total += score;
    }
    this.bestFitness = Number.isFinite(max) ? max : 0;
    this.avgFitness  = total / this.populationSize;
  }

  nextGeneration() {
    if (this.populationSize === 1) {
      const currentFitness = this._scoreCreature(this.population[0]);
      const currentBrain = this.brains[0];
      if (currentFitness > this.bestSoloFitness || !this.bestSoloBrain) {
        this.bestSoloFitness = currentFitness;
        this.bestSoloBrain = currentBrain.clone();
      }

      const genData = { gen: this.generation, best: currentFitness, avg: currentFitness };
      this.history.push(genData);

      const nextBrain = this.bestSoloBrain.mutate(0.14, 0.22);
      this.population.forEach(c => c.dispose());
      this._initPopulation([nextBrain]);
      this.generation++;

      return genData;
    }

    // Rank by fitness
    const ranked = this.brains
      .map((brain, i) => ({ brain, fitness: this._scoreCreature(this.population[i]) }))
      .sort((a, b) => b.fitness - a.fitness);

    const genData = { gen: this.generation, best: ranked[0].fitness, avg: this.avgFitness };
    this.history.push(genData);

    const topCount = Math.max(2, Math.floor(this.populationSize * 0.25));
    const winners  = ranked.slice(0, topCount);

    const newBrains = winners.map(w => w.brain.clone()); // elites survive
    while (newBrains.length < this.populationSize) {
      const parent = winners[Math.floor(Math.random() * winners.length)];
      newBrains.push(parent.brain.mutate(0.12, 0.25));
    }

    // Dispose old
    this.population.forEach(c => c.dispose());
    this._initPopulation(newBrains);
    this.generation++;

    return genData;
  }

  // ── Serialization ──────────────────────────────────────────
  toJSON() {
    return {
      version:        1,
      generation:     this.generation,
      populationSize: this.populationSize,
      history:        this.history,
      brains:         this.brains.map(b => b.toJSON()),
    };
  }

  loadJSON(data) {
    if (data.version !== 1) throw new Error('Unknown save version');
    this.generation = data.generation;
    this.history    = data.history ?? [];

    const brains = data.brains.map(b => Brain.fromJSON(b));
    // Mutate elites slightly so they resume learning
    const newBrains = brains.map((b, i) => i < 2 ? b.clone() : b.mutate(0.05, 0.1));

    this.population.forEach(c => c.dispose());
    this._initPopulation(newBrains.slice(0, this.populationSize));
    this.bestSoloFitness = -Infinity;
    this.bestSoloBrain   = null;
  }
}
