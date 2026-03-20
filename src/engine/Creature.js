export class Creature {
  constructor(id, physics, spawnPos = { x: 0, y: 2 }, morphology = null) {
    this.id = id;
    this.physics = physics;
    this.RAPIER = physics.RAPIER;
    this.world = physics.world;
    this.parts = [];
    this.joints = [];
    this.spawnPos = spawnPos;
    this.alive = true;
    this.fitness = 0;
    this.stepCount = 0;
    this.morphology = morphology ?? {
      torsoHalfWidth: 0.4,
      thighHalfHeight: 0.3,
      shinHalfHeight: 0.3,
      legDensity: 1.0,
      torsoDensity: 1.1,
      hipOffsetX: 0.3,
      hipOffsetY: -0.1,
    };
    
    this.build();
  }

  build() {
    const { x, y } = this.spawnPos;
    const m = this.morphology;
    const thighW = 0.1;
    const shinW = 0.08;
    const torsoH = 0.2;

    // Torso (slippery)
    this.torso = this.physics.createPart(x, y, m.torsoHalfWidth, torsoH, m.torsoDensity, 0.1);
    if (typeof this.torso.setAngularDamping === 'function') this.torso.setAngularDamping(2.2);
    if (typeof this.torso.setLinearDamping === 'function') this.torso.setLinearDamping(0.12);
    this.parts.push(this.torso);

    // Left Leg
    const lHipX = x - m.hipOffsetX;
    const rHipX = x + m.hipOffsetX;
    const hipY = y + m.hipOffsetY;
    const thighCenterY = hipY - m.thighHalfHeight;
    const shinCenterY = thighCenterY - m.thighHalfHeight - m.shinHalfHeight;

    // Legs (grippy, especially shins)
    this.lThigh = this.physics.createPart(lHipX, thighCenterY, thighW, m.thighHalfHeight, m.legDensity, 0.5);
    this.lShin = this.physics.createPart(lHipX, shinCenterY, shinW, m.shinHalfHeight, m.legDensity, 1.8);
    this.parts.push(this.lThigh, this.lShin);

    // Right Leg
    this.rThigh = this.physics.createPart(rHipX, thighCenterY, thighW, m.thighHalfHeight, m.legDensity, 0.5);
    this.rShin = this.physics.createPart(rHipX, shinCenterY, shinW, m.shinHalfHeight, m.legDensity, 1.8);
    this.parts.push(this.rThigh, this.rShin);

    // Create Joints (Revolute)
    // Hip joints: -60 to 60 degrees
    this.createJoint(
      this.torso,
      this.lThigh,
      { x: -m.hipOffsetX, y: m.hipOffsetY },
      { x: 0, y: m.thighHalfHeight },
      -Math.PI / 3,
      Math.PI / 3,
    );
    this.createJoint(
      this.torso,
      this.rThigh,
      { x: m.hipOffsetX, y: m.hipOffsetY },
      { x: 0, y: m.thighHalfHeight },
      -Math.PI / 3,
      Math.PI / 3,
    );

    // Knee joints: -90 to 0 degrees (can't bend forward)
    this.createJoint(
      this.lThigh,
      this.lShin,
      { x: 0, y: -m.thighHalfHeight },
      { x: 0, y: m.shinHalfHeight },
      -Math.PI / 2,
      0,
    );
    this.createJoint(
      this.rThigh,
      this.rShin,
      { x: 0, y: -m.thighHalfHeight },
      { x: 0, y: m.shinHalfHeight },
      -Math.PI / 2,
      0,
    );

    // Slight knee bend at spawn gives a more stable stance than fully straight legs.
    this.joints[2]?.configureMotorPosition(-0.42, 32.0, 1.4);
    this.joints[3]?.configureMotorPosition(-0.42, 32.0, 1.4);

    // Tail (medium friction)
    this.tail = this.physics.createPart(x - m.torsoHalfWidth - 0.3, y, 0.3, 0.06, 0.6, 0.4);
    this.parts.push(this.tail);
    this.createJoint(
      this.torso, this.tail,
      { x: -m.torsoHalfWidth, y: 0 }, { x: 0.3, y: 0 },
      -Math.PI / 3, Math.PI / 3
    );

    // Arms (slippery)
    const armX = x + m.torsoHalfWidth - 0.1;
    const shoulderY = y + torsoH - 0.05;
    const armCenterY = shoulderY - 0.2;
    const forearmCenterY = armCenterY - 0.2 - 0.2;

    this.lArm = this.physics.createPart(armX, armCenterY, 0.06, 0.2, 0.8, 0.1);
    this.lForearm = this.physics.createPart(armX, forearmCenterY, 0.05, 0.2, 0.8, 0.2);
    this.parts.push(this.lArm, this.lForearm);
    
    this.rArm = this.physics.createPart(armX, armCenterY, 0.06, 0.2, 0.8, 0.1);
    this.rForearm = this.physics.createPart(armX, forearmCenterY, 0.05, 0.2, 0.8, 0.2);
    this.parts.push(this.rArm, this.rForearm);

    // Shoulders (-180 to 180 degrees approx)
    this.createJoint(this.torso, this.lArm, { x: m.torsoHalfWidth - 0.1, y: torsoH - 0.05 }, { x: 0, y: 0.2 }, -Math.PI*0.8, Math.PI*0.8);
    this.createJoint(this.torso, this.rArm, { x: m.torsoHalfWidth - 0.1, y: torsoH - 0.05 }, { x: 0, y: 0.2 }, -Math.PI*0.8, Math.PI*0.8);

    // Elbows (bend forwards, 0 to 140 degrees)
    this.createJoint(this.lArm, this.lForearm, { x: 0, y: -0.2 }, { x: 0, y: 0.2 }, 0, Math.PI * 0.8);
    this.createJoint(this.rArm, this.rForearm, { x: 0, y: -0.2 }, { x: 0, y: 0.2 }, 0, Math.PI * 0.8);
  }

  createJoint(parent, child, anchor1, anchor2, minAngle, maxAngle) {
    const params = this.RAPIER.JointData.revolute(anchor1, anchor2);
    params.limitsEnabled = true;
    params.limits = [minAngle, maxAngle];
    
    const joint = this.world.createImpulseJoint(params, parent, child, true);
    joint.configureMotorPosition(0, 28.0, 1.2);
    this.joints.push(joint);
  }

  getInputs() {
    // Inputs for the neural network
    const inputs = [];
    
    // 1. Central Pattern Generator (Clock)
    // Helps the creature learn rhythmic movements like walking
    inputs.push(Math.sin(this.stepCount * 0.08) * 3.0);
    inputs.push(Math.cos(this.stepCount * 0.08) * 3.0);

    // Torso rotation and velocity (scaled down to prevent saturation)
    inputs.push(this.torso.rotation() * 0.3);
    inputs.push(this.torso.linvel().x * 0.1);
    inputs.push(this.torso.linvel().y * 0.1);
    inputs.push(this.torso.angvel() * 0.1);

    // Rotation of all parts (scaled down)
    this.parts.forEach(p => {
        inputs.push(p.rotation() * 0.25);
    });

    // Simple ground contact sensor (if Y is close to ground level -1.5)
    // Values 0 or 1 are already well-scaled
    const groundLevel = -1.5;
    const shinGroundY = groundLevel + this.morphology.shinHalfHeight;
    const threshold = Math.max(0.08, this.morphology.shinHalfHeight * 0.35);
    inputs.push(Math.abs(this.lShin.translation().y - shinGroundY) < threshold ? 1 : 0);
    inputs.push(Math.abs(this.rShin.translation().y - shinGroundY) < threshold ? 1 : 0);

    return inputs;
  }

  applyActions(actions) {
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const torsoAngle = this.torso.rotation();
    const torsoAngVel = this.torso.angvel();
    const stabilizer = clamp(-torsoAngle * 0.9 - torsoAngVel * 0.2, -0.45, 0.45);
    if (typeof this.torso.addTorque === 'function') {
      const balanceTorque = clamp(-torsoAngle * 16 - torsoAngVel * 4, -18, 18);
      this.torso.addTorque(balanceTorque, true);
    }

    // We blend NN outputs with a balance reflex so the creature
    // has a slight starting hint.
    const hipL = clamp(stabilizer + (actions[0] ?? 0) * 1.5, -Math.PI / 3, Math.PI / 3);
    const hipR = clamp(-stabilizer + (actions[1] ?? 0) * 1.5, -Math.PI / 3, Math.PI / 3);

    // Knees can bend backward slightly or forward significantly
    const kneeBase = -0.45;
    const kneeL = clamp(kneeBase + (actions[2] ?? 0) * 1.5, -Math.PI / 2, 0);
    const kneeR = clamp(kneeBase + (actions[3] ?? 0) * 1.5, -Math.PI / 2, 0);

    // Tail (actions[4]) - full whip action
    const tailAngle = clamp((actions[4] ?? 0) * 1.8, -Math.PI / 3, Math.PI / 3);

    // Arms - wider swing
    const shoulderL = clamp((actions[5] ?? 0) * 2.0, -Math.PI * 0.8, Math.PI * 0.8);
    const shoulderR = clamp((actions[6] ?? 0) * 2.0, -Math.PI * 0.8, Math.PI * 0.8);
    const elbowL = clamp((actions[7] ?? 0) * 1.8, 0, Math.PI * 0.8);
    const elbowR = clamp((actions[8] ?? 0) * 1.8, 0, Math.PI * 0.8);

    const targets = [hipL, hipR, kneeL, kneeR, tailAngle, shoulderL, shoulderR, elbowL, elbowR];
    this.joints.forEach((joint, i) => {
      // Less damping = faster snaps. High stiffness = forceful strokes.
      let stiffness = 45.0;
      let damping = 0.5;
      
      if (i === 4) { stiffness = 20.0; damping = 0.4; } // tail
      else if (i > 4) { stiffness = 30.0; damping = 0.5; } // arms

      joint.configureMotorPosition(targets[i], stiffness, damping);
    });
    this.stepCount += 1;
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
    // В Rapier сначала нужно удалять суставы, чтобы избежать краша (Unsafe aliasing / Unreachable code) 
    // при удалении связанных RigidBody.
    if (this.joints) {
      this.joints.forEach(j => this.world.removeImpulseJoint(j));
    }
    if (this.parts) {
      this.parts.forEach(p => this.world.removeRigidBody(p));
    }
    this.joints = [];
    this.parts = [];
  }
}
