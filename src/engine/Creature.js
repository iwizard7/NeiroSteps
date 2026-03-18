export class Creature {
  constructor(id, physics, spawnPos = { x: 0, y: 2 }) {
    this.id = id;
    this.physics = physics;
    this.RAPIER = physics.RAPIER;
    this.world = physics.world;
    this.parts = [];
    this.joints = [];
    this.spawnPos = spawnPos;
    this.alive = true;
    this.fitness = 0;
    
    this.build();
  }

  build() {
    const { x, y } = this.spawnPos;

    // Torso
    this.torso = this.physics.createPart(x, y, 0.4, 0.2);
    this.parts.push(this.torso);

    // Left Leg
    this.lThigh = this.physics.createPart(x - 0.3, y - 0.4, 0.1, 0.3);
    this.lShin = this.physics.createPart(x - 0.3, y - 1.0, 0.08, 0.3);
    this.parts.push(this.lThigh, this.lShin);

    // Right Leg
    this.rThigh = this.physics.createPart(x + 0.3, y - 0.4, 0.1, 0.3);
    this.rShin = this.physics.createPart(x + 0.3, y - 1.0, 0.08, 0.3);
    this.parts.push(this.rThigh, this.rShin);

    // Create Joints (Revolute)
    // Hip joints: -60 to 60 degrees
    this.createJoint(this.torso, this.lThigh, { x: -0.3, y: -0.1 }, { x: 0, y: 0.3 }, -Math.PI / 3, Math.PI / 3);
    this.createJoint(this.torso, this.rThigh, { x: 0.3, y: -0.1 }, { x: 0, y: 0.3 }, -Math.PI / 3, Math.PI / 3);

    // Knee joints: -90 to 0 degrees (can't bend forward)
    this.createJoint(this.lThigh, this.lShin, { x: 0, y: -0.3 }, { x: 0, y: 0.3 }, -Math.PI / 2, 0);
    this.createJoint(this.rThigh, this.rShin, { x: 0, y: -0.3 }, { x: 0, y: 0.3 }, -Math.PI / 2, 0);
  }

  createJoint(parent, child, anchor1, anchor2, minAngle, maxAngle) {
    const params = this.RAPIER.JointData.revolute(anchor1, anchor2);
    params.limitsEnabled = true;
    params.limits = [minAngle, maxAngle];
    
    const joint = this.world.createImpulseJoint(params, parent, child, true);
    joint.configureMotorPosition(0, 20.0, 0.5); 
    this.joints.push(joint);
  }

  getInputs() {
    // Inputs for the neural network
    const inputs = [];
    
    // Torso rotation and velocity
    inputs.push(this.torso.rotation());
    inputs.push(this.torso.linvel().x);
    inputs.push(this.torso.linvel().y);
    inputs.push(this.torso.angvel());

    // For now, let's feed the rotation of all parts + ground contact for shins
    this.parts.forEach(p => {
        inputs.push(p.rotation());
    });

    // Simple ground contact sensor (if Y is close to ground level -1.5)
    const groundLevel = -1.5;
    inputs.push(Math.abs(this.lShin.translation().y - (groundLevel + 0.3)) < 0.1 ? 1 : 0);
    inputs.push(Math.abs(this.rShin.translation().y - (groundLevel + 0.3)) < 0.1 ? 1 : 0);

    return inputs;
  }

  applyActions(actions) {
    // Neural network outputs will control motor positions
    this.joints.forEach((joint, i) => {
        const targetAngle = actions[i] * Math.PI / 2; // Map -1..1 to -90..90 degrees
        joint.configureMotorPosition(targetAngle, 20.0, 1.0);
    });
  }

  updateFitness() {
    if (!this.alive) return;
    const currentX = this.torso.translation().x;
    if (currentX > this.fitness) {
        this.fitness = currentX;
    }
    
    // Check if fallen (torso too close to ground or too low)
    if (this.torso.translation().y < 0.2) {
        // this.alive = false; // Optional: kill if they fall
    }
  }

  dispose() {
    this.parts.forEach(p => this.world.removeRigidBody(p));
  }
}
