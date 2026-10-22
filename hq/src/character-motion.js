import * as THREE from 'three';

const FADE_SECONDS = 0.16;
const DEFAULT_WALK_SPEED = 1.65;
const MAX_DT = 0.1;
const SPEED_EPSILON = 0.01;

function clipByName(clips, name) {
  const wanted = name.toLowerCase();
  return clips.find((clip) => clip instanceof THREE.AnimationClip && String(clip.name).trim().toLowerCase() === wanted);
}

/**
 * Remove root translation from a clip so gameplay movement is the only source of
 * XZ displacement. Named Root translation is removed too; Hips bob is retained.
 */
function withoutRootTranslation(clip, root) {
  clip.tracks = clip.tracks.filter((track) => {
    let parsed;
    try {
      parsed = THREE.PropertyBinding.parseTrackName(track.name);
    } catch (cause) {
      const error = new Error(`Invalid animation track "${track?.name}" in clip "${clip.name}"`);
      error.cause = cause;
      throw error;
    }
    if (parsed.propertyName !== 'position') return true;
    if (parsed.nodeName === 'Root') return false;
    if (root.name && parsed.nodeName === root.name) return false;
    if (!root.name && !parsed.nodeName) return false;
    return THREE.PropertyBinding.findNode(root, parsed.nodeName) !== root;
  });
  return clip;
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * Drives an already-rigged GLTF character with Idle and Walk clips.
 *
 * `update(dt, speed)` expects speed in metres per second of actual XZ
 * displacement. It does not read keyboard state or move the root.
 */
export class CharacterMotion {
  constructor(root, clips) {
    if (!root?.isObject3D) throw new TypeError('CharacterMotion requires an Object3D root');
    if (!Array.isArray(clips)) throw new TypeError('CharacterMotion requires an AnimationClip array');

    const idleClip = clipByName(clips, 'Idle');
    const walkClip = clipByName(clips, 'Walk');
    const missing = [!idleClip && 'Idle', !walkClip && 'Walk'].filter(Boolean);
    if (missing.length) throw new Error(`CharacterMotion missing required clip(s): ${missing.join(', ')}`);

    this.root = root;
    this.fadeSeconds = FADE_SECONDS;
    this.walkSpeed = finiteNonNegative(root.userData?.walkSpeed) || DEFAULT_WALK_SPEED;
    this.mixer = new THREE.AnimationMixer(root);
    this.idleAction = this.mixer.clipAction(withoutRootTranslation(idleClip.clone(), root));
    this.walkAction = this.mixer.clipAction(withoutRootTranslation(walkClip.clone(), root));
    this.idleAction.setEffectiveWeight(1).play();
    this.walkAction.setEffectiveWeight(0).play();
    this.walkAction.time = 0;
    this.walkAction.paused = true;
    this.poses=new Map(clips.filter(c=>!['idle','walk'].includes(c.name.toLowerCase())).map(c=>[c.name,this.mixer.clipAction(withoutRootTranslation(c.clone(),root))]));
    this.pose=null;
    this.walkWeight = 0;
    this.disposed = false;
    this.state = {
      mode: 'idle',
      speed: 0,
      paused: false,
      reducedMotion: false,
      timeScale: 1,
      walkSpeed: this.walkSpeed,
      idleWeight: 1,
      walkWeight: 0,
      walkTime: 0,
      disposed: false,
    };
  }

  update(dt, speed, { paused = false, reducedMotion = false } = {}) {
    if (this.disposed) return;
    const clampedDt = Math.min(MAX_DT, finiteNonNegative(dt));
    const actualSpeed = finiteNonNegative(speed);
    this.state.speed = actualSpeed;
    this.state.paused = Boolean(paused);
    this.state.reducedMotion = Boolean(reducedMotion);
    this.state.idleWeight = 1 - this.walkWeight;
    this.state.walkWeight = this.walkWeight;
    if (paused) {
      this.state.walkTime = this.walkAction.time;
      return;
    }

    if(this.pose&&actualSpeed<=SPEED_EPSILON){
      this.idleAction.setEffectiveWeight(0);this.walkAction.setEffectiveWeight(0);
      const action=this.poses.get(this.pose);action.paused=Boolean(reducedMotion);
      this.state.mode=this.pose;this.state.idleWeight=0;this.state.walkWeight=0;
      this.mixer.update(clampedDt);this.root.updateMatrixWorld(true);return;
    }
    if(this.pose)this.setPose(null);

    const walking = actualSpeed > SPEED_EPSILON;
    this.idleAction.paused = Boolean(reducedMotion);
    if (this.idleAction.paused) this.idleAction.time = 0;

    // Move the current blending weights directly; do not use Three's fadeIn/fadeOut,
    // which always starts an outgoing action again from weight 1.
    const targetWalkWeight = walking ? 1 : 0;
    const step = clampedDt / this.fadeSeconds;
    if (this.walkWeight < targetWalkWeight) {
      this.walkWeight = Math.min(targetWalkWeight, this.walkWeight + step);
    } else if (this.walkWeight > targetWalkWeight) {
      this.walkWeight = Math.max(targetWalkWeight, this.walkWeight - step);
    }
    this.state.mode = walking ? 'walk' : 'idle';
    this.state.idleWeight = 1 - this.walkWeight;
    this.state.walkWeight = this.walkWeight;
    this.idleAction.setEffectiveWeight(this.state.idleWeight);
    this.walkAction.setEffectiveWeight(this.walkWeight);

    if (walking) {
      // Unpause the same action; never reset its time or timeScale here.
      this.walkAction.paused = false;
      const timeScale = Math.max(0.15, Math.min(2.5, actualSpeed / this.walkSpeed));
      this.walkAction.setEffectiveTimeScale(timeScale);
      this.state.timeScale = timeScale;
    } else {
      this.state.timeScale = 1;
      if (this.walkWeight === 0) this.walkAction.paused = true;
    }

    this.mixer.update(clampedDt);
    this.root.updateMatrixWorld(true);
    this.state.walkTime = this.walkAction.time;
  }

  getState() {
    return Object.freeze({ ...this.state, disposed: this.disposed });
  }

  /** Presentation only. A pose never changes a task or the world position. */
  setPose(name){
    if(this.disposed)throw new Error('CharacterMotion disposed');
    if(name!==null&&!this.poses.has(name))throw new Error(`Unknown character pose: ${name}`);
    if(this.pose===name)return;
    for(const action of this.poses.values())action.stop();
    this.pose=name;
    if(name)this.poses.get(name).reset().setEffectiveWeight(1).play();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.state.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.idleAction = null;
    this.walkAction = null;
    this.poses.clear();
  }
}

/** Convenience accessor for integration tests and UI/debug panels; no window globals. */
export function getMotionState(motion) {
  return motion?.getState?.() ?? null;
}
