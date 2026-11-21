import * as THREE from 'three';
import { DEFAULT_JOINTS } from '../types/arm.ts';
import { computeForwardKinematics, DEG2RAD, RAD2DEG } from './armModel.ts';

export type AnchorId = 'elbow' | 'wrist' | 'tip';

export interface IKSolution {
  angles: number[];
  errorUnits: number;
  reachable: boolean;
}

const ANCHOR_ACTIVE_JOINTS: Record<AnchorId, number[]> = {
  elbow: [1],
  wrist: [2, 1],
  tip: [3, 2, 1],
};

function clampJoint(index: number, deg: number): number {
  const cfg = DEFAULT_JOINTS[index];
  return Math.max(cfg.min_angle, Math.min(cfg.max_angle, deg));
}

function normalizeDeg(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Pick the J0 base yaw servo angle in [0°, 180°] that aligns the arm's
 * vertical XY working plane with the target's (x, z) coordinates while
 * staying closest to the current J0 angle to avoid sudden 180° flips.
 */
function solveBaseYaw(currentJ0: number, target: THREE.Vector3): number {
  const horizDist = Math.hypot(target.x, target.z);
  if (horizDist < 0.08) {
    return currentJ0;
  }

  // Two opposite planes both contain (target.x, target.z):
  // +localX points to (cos(j0), -sin(j0)) -> j0 = atan2(-z, x)
  // -localX points to (-cos(j0), sin(j0)) -> j0 = atan2(z, -x)
  const candA = 90 + normalizeDeg(Math.atan2(-target.z, target.x) * RAD2DEG);
  const candB = 90 + normalizeDeg(Math.atan2(target.z, -target.x) * RAD2DEG);

  const valid: number[] = [];
  for (const c of [candA, candB]) {
    if (c >= 0 && c <= 180) {
      valid.push(c);
    }
  }

  if (valid.length === 0) {
    // Clamp whichever candidate is closer to [0, 180]
    const clampedA = clampJoint(0, candA);
    const clampedB = clampJoint(0, candB);
    return Math.abs(clampedA - currentJ0) <= Math.abs(clampedB - currentJ0)
      ? clampedA
      : clampedB;
  }

  return valid.reduce((best, c) =>
    Math.abs(c - currentJ0) < Math.abs(best - currentJ0) ? c : best
  );
}

/**
 * Solve Inverse Kinematics so the selected joint anchor ('elbow', 'wrist', or 'tip')
 * reaches `target` in world space by modifying all upstream angles simultaneously.
 */
export function solveIKForAnchor(
  currentAngles: number[],
  anchor: AnchorId,
  target: THREE.Vector3,
  iterations = 28
): IKSolution {
  const angles = [...currentAngles];

  // Keep target above the table plane (y >= 0.15 = 1.5 cm)
  const safeTarget = target.clone();
  safeTarget.y = Math.max(0.15, safeTarget.y);

  // 1. Align base yaw (J0) to the target's vertical plane
  angles[0] = solveBaseYaw(angles[0] ?? 90, safeTarget);

  const j0Rad = (angles[0] - 90) * DEG2RAD;
  // World-space +Z pitch axis of the arm after J0 yaw rotation
  const pitchAxis = new THREE.Vector3(0, 0, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    j0Rad
  );

  const activeJoints = ANCHOR_ACTIVE_JOINTS[anchor];
  const getEndPos = (a: number[]) => computeForwardKinematics(a)[anchor];

  // 2. Damped Cyclic Coordinate Descent (CCD) over active pitch joints
  for (let iter = 0; iter < iterations; iter++) {
    const endBefore = getEndPos(angles);
    if (endBefore.distanceTo(safeTarget) < 0.005) {
      break;
    }

    for (const jointIdx of activeJoints) {
      const fk = computeForwardKinematics(angles);
      const jointPos =
        jointIdx === 1 ? fk.shoulder : jointIdx === 2 ? fk.elbow : fk.wrist;
      const endPos = fk[anchor];

      const toEnd = endPos.clone().sub(jointPos);
      const toTarget = safeTarget.clone().sub(jointPos);

      // Project both vectors onto the plane perpendicular to pitchAxis
      toEnd.addScaledVector(pitchAxis, -toEnd.dot(pitchAxis));
      toTarget.addScaledVector(pitchAxis, -toTarget.dot(pitchAxis));

      if (toEnd.lengthSq() < 1e-6 || toTarget.lengthSq() < 1e-6) {
        continue;
      }

      toEnd.normalize();
      toTarget.normalize();

      const dot = Math.max(-1, Math.min(1, toEnd.dot(toTarget)));
      const cross = new THREE.Vector3().crossVectors(toEnd, toTarget);
      const signedAngleRad = Math.atan2(cross.dot(pitchAxis), dot);

      // J2 elbow rotation is inverted relative to +Z
      const jointSign = jointIdx === 2 ? -1 : 1;
      const deltaDeg = signedAngleRad * RAD2DEG * jointSign * 0.65;

      angles[jointIdx] = clampJoint(jointIdx, angles[jointIdx] + deltaDeg);
    }
  }

  const finalPos = getEndPos(angles);
  const errorUnits = finalPos.distanceTo(safeTarget);

  return {
    angles: angles.map((a) => Math.round(a * 10) / 10),
    errorUnits,
    reachable: errorUnits < 0.15, // Within 1.5 cm
  };
}
