import * as RAPIER_MODULE from '@dimforge/rapier2d-compat';

export const initPhysics = async () => {
  await RAPIER_MODULE.init();
  return RAPIER_MODULE;
};

export class PhysicsEngine {
  constructor(RAPIER) {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0.0, y: -9.81 });
    this.eventQueue = new RAPIER.EventQueue(true);
    this.world.timestep = 1 / 60;
  }

  step() {
    this.world.step(this.eventQueue);
  }

  createGround() {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, -2.0);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(500.0, 0.5);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  createPart(x, y, w, h, density = 1.0) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(w, h).setDensity(density);
    this.world.createCollider(colliderDesc, body);
    return body;
  }
}
