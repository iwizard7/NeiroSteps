import { Creature } from './Creature';
import { Brain }   from './NeuralNet';

const INPUT_SIZE  = 18;
const HIDDEN_SIZE = 24;
const OUTPUT_SIZE = 9;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const MORPH_LIMITS = {
  torsoHalfWidth: [0.34, 0.5],
  thighHalfHeight: [0.24, 0.4],
  shinHalfHeight: [0.24, 0.4],
  legDensity: [0.75, 1.4],
  torsoDensity: [0.9, 1.5],
  hipOffsetX: [0.18, 0.38],
  hipOffsetY: [-0.18, -0.06],
};

const DEFAULT_MORPHOLOGY = {
  torsoHalfWidth: 0.4,
  thighHalfHeight: 0.3,
  shinHalfHeight: 0.3,
  legDensity: 1.0,
  torsoDensity: 1.1,
  hipOffsetX: 0.27,
  hipOffsetY: -0.1,
};

const normalizeMorphology = (m) => {
  const out = {
    torsoHalfWidth: clamp(Number(m?.torsoHalfWidth ?? DEFAULT_MORPHOLOGY.torsoHalfWidth), ...MORPH_LIMITS.torsoHalfWidth),
    thighHalfHeight: clamp(Number(m?.thighHalfHeight ?? DEFAULT_MORPHOLOGY.thighHalfHeight), ...MORPH_LIMITS.thighHalfHeight),
    shinHalfHeight: clamp(Number(m?.shinHalfHeight ?? DEFAULT_MORPHOLOGY.shinHalfHeight), ...MORPH_LIMITS.shinHalfHeight),
    legDensity: clamp(Number(m?.legDensity ?? DEFAULT_MORPHOLOGY.legDensity), ...MORPH_LIMITS.legDensity),
    torsoDensity: clamp(Number(m?.torsoDensity ?? DEFAULT_MORPHOLOGY.torsoDensity), ...MORPH_LIMITS.torsoDensity),
    hipOffsetX: clamp(Number(m?.hipOffsetX ?? DEFAULT_MORPHOLOGY.hipOffsetX), ...MORPH_LIMITS.hipOffsetX),
    hipOffsetY: clamp(Number(m?.hipOffsetY ?? DEFAULT_MORPHOLOGY.hipOffsetY), ...MORPH_LIMITS.hipOffsetY),
  };

  const hipMargin = 0.04;
  out.hipOffsetX = Math.min(out.hipOffsetX, Math.max(0.18, out.torsoHalfWidth - hipMargin));
  return out;
};

const cloneMorphology = (m) => normalizeMorphology({ ...m });

const mutateMorphology = (m) => {
  const out = cloneMorphology(m);
  const mutate = (key, factor = 0.14) => {
    if (Math.random() > 0.85) return;
    const [min, max] = MORPH_LIMITS[key];
    const range = max - min;
    const next = out[key] + (Math.random() * 2 - 1) * range * factor;
    out[key] = clamp(next, min, max);
  };

  mutate('torsoHalfWidth', 0.1);
  mutate('thighHalfHeight', 0.12);
  mutate('shinHalfHeight', 0.12);
  mutate('legDensity', 0.1);
  mutate('torsoDensity', 0.1);
  mutate('hipOffsetX', 0.1);
  mutate('hipOffsetY', 0.08);

  return normalizeMorphology(out);
};

export class EvolutionManager {
  constructor(populationSize, physics) {
    this.populationSize = populationSize;
    this.physics        = physics;
    this.generation     = 1;
    this.population     = [];
    this.brains         = [];
    this.morphologies   = [];
    this.bestFitness    = 0;
    this.avgFitness     = 0;
    this.history        = [];
    this.bestSoloFitness = -Infinity;
    this.bestSoloBrain   = null;
    this.bestSoloMorphology = null;

    this._initPopulation(null, null);
  }

  _scoreCreature(creature) {
    const displacement = creature.torso.translation().x - creature.spawnPos.x;
    const backwardPenalty = Math.max(0, -displacement) * 0.8;
    return creature.fitness - backwardPenalty;
  }

  _initPopulation(brains = null, morphologies = null) {
    this.population = [];
    this.brains     = [];
    this.morphologies = [];
    for (let i = 0; i < this.populationSize; i++) {
      const brain = brains?.[i] ?? new Brain(INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE);
      const morphology = cloneMorphology(
        morphologies?.[i] ??
        (this.populationSize === 1 ? DEFAULT_MORPHOLOGY : mutateMorphology(DEFAULT_MORPHOLOGY)),
      );
      const spawnPos = { x: 0, y: this._spawnYForMorphology(morphology) };
      this.population.push(new Creature(i, this.physics, spawnPos, morphology));
      this.brains.push(brain);
      this.morphologies.push(morphology);
    }
  }

  _spawnYForMorphology(morphology) {
    const groundTop = -1.5;
    const legsTotal = morphology.thighHalfHeight + morphology.shinHalfHeight;
    const footClearance = 0.04;
    // hipY = torsoY + hipOffsetY => torsoY = hipY - hipOffsetY
    return groundTop + legsTotal + footClearance - morphology.hipOffsetY;
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
      const currentMorphology = this.morphologies[0];
      if (currentFitness > this.bestSoloFitness || !this.bestSoloBrain || !this.bestSoloMorphology) {
        this.bestSoloFitness = currentFitness;
        this.bestSoloBrain = currentBrain.clone();
        this.bestSoloMorphology = cloneMorphology(currentMorphology);
      }

      const genData = { gen: this.generation, best: currentFitness, avg: currentFitness };
      this.history.push(genData);

      const nextBrain = this.bestSoloBrain.mutate(0.14, 0.22);
      const shouldMutateMorphology = this.generation > 8 && this.bestSoloFitness > 0.25 && this.generation % 2 === 0;
      const nextMorphology = shouldMutateMorphology
        ? mutateMorphology(this.bestSoloMorphology)
        : cloneMorphology(this.bestSoloMorphology);
      this.population.forEach(c => c.dispose());
      this._initPopulation([nextBrain], [nextMorphology]);
      this.generation++;

      return genData;
    }

    // Rank by fitness
    const ranked = this.brains
      .map((brain, i) => ({
        brain,
        morphology: this.morphologies[i],
        fitness: this._scoreCreature(this.population[i]),
      }))
      .sort((a, b) => b.fitness - a.fitness);

    const genData = { gen: this.generation, best: ranked[0].fitness, avg: this.avgFitness };
    this.history.push(genData);

    const topCount = Math.max(2, Math.floor(this.populationSize * 0.25));
    const winners  = ranked.slice(0, topCount);

    const newBrains = winners.map(w => w.brain.clone()); // elites survive
    const newMorphologies = winners.map(w => cloneMorphology(w.morphology));
    while (newBrains.length < this.populationSize) {
      const parent = winners[Math.floor(Math.random() * winners.length)];
      newBrains.push(parent.brain.mutate(0.12, 0.25));
      newMorphologies.push(mutateMorphology(parent.morphology));
    }

    // Dispose old
    this.population.forEach(c => c.dispose());
    this._initPopulation(newBrains, newMorphologies);
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
      morphologies:   this.morphologies.map(m => normalizeMorphology(m)),
    };
  }

  loadJSON(data) {
    if (data.version !== 1) throw new Error('Unknown save version');
    
    // Check compatibility with new anatomy (18 inputs, 9 outputs)
    const sampleBrain = data.brains[0];
    if (sampleBrain && (sampleBrain.inputSize !== INPUT_SIZE || sampleBrain.outputSize !== OUTPUT_SIZE)) {
      throw new Error(`Сохранение несовместимо с текущей анатомией! (Ожидалось входов: ${INPUT_SIZE}, выходов: ${OUTPUT_SIZE}, но в файле: ${sampleBrain.inputSize}/${sampleBrain.outputSize}). Начните обучение заново.`);
    }

    this.generation = data.generation;
    this.history    = data.history ?? [];

    const brains = data.brains.map(b => Brain.fromJSON(b));
    const loadedMorphologies = Array.isArray(data.morphologies)
      ? data.morphologies.map(m => normalizeMorphology(m))
      : brains.map(() => cloneMorphology(DEFAULT_MORPHOLOGY));

    // Mutate elites slightly so they resume learning
    const newBrains = brains.map((b, i) => i < 2 ? b.clone() : b.mutate(0.05, 0.1));
    const newMorphologies = loadedMorphologies.map((m, i) => i < 2 ? cloneMorphology(m) : mutateMorphology(m));

    this.population.forEach(c => c.dispose());
    this._initPopulation(
      newBrains.slice(0, this.populationSize),
      newMorphologies.slice(0, this.populationSize),
    );
    this.bestSoloFitness = -Infinity;
    this.bestSoloBrain   = null;
    this.bestSoloMorphology = null;
  }
}
