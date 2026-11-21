import * as THREE from 'three';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/**
 * Physical dimensions scaled at 1 scene unit = 10 cm.
 * Matches the ~43 cm total vertical reach and 9 cm x 8.4 cm base
 * from the real 6-DOF aluminum arm specifications.
 */
export const ARM_LINKS = {
  basePlateHeight: 0.24,
  turretHeight: 0.34,
  shoulderOffsetY: 0.27, // Total shoulder pivot Y = 0.85 (8.5 cm)
  upperArmLength: 1.05,  // 10.5 cm twin U-bracket
  forearmLength: 1.15,   // 11.5 cm silver cylindrical aluminum tube
  wristToTipLength: 1.25, // 12.5 cm wrist U-bracket + J4 servo + claw tip
} as const;

export const SHOULDER_Y =
  ARM_LINKS.basePlateHeight + ARM_LINKS.turretHeight + ARM_LINKS.shoulderOffsetY;

export const MAX_ARM_REACH =
  ARM_LINKS.upperArmLength + ARM_LINKS.forearmLength + ARM_LINKS.wristToTipLength;

export interface ArmJointPositions {
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  wrist: THREE.Vector3;
  tip: THREE.Vector3;
}

/**
 * Convert servo degrees [0..180] into Three.js local radians
 * matching the physical mechanism's directions and offsets.
 */
export function servoToRadians(angles: number[]) {
  return {
    j0: ((angles[0] ?? 90) - 90) * DEG2RAD,   // Base Yaw (+Y)
    j1: ((angles[1] ?? 90) - 90) * DEG2RAD,   // Shoulder Pitch (+Z)
    j2: -((angles[2] ?? 90) - 90) * DEG2RAD,  // Elbow Pitch (+Z, inverted)
    j3: ((angles[3] ?? 90) - 90) * DEG2RAD,   // Wrist Pitch (+Z)
    j4: (angles[4] ?? 90) * DEG2RAD,          // Wrist Roll (+Y, +90° visual offset)
  };
}

/**
 * Normalized gripper openness in [0, 1]:
 *   75° -> 1.0 (fully open)
 *  180° -> 0.0 (fully closed)
 */
export function getGripperOpenness(angle: number): number {
  const clamped = Math.max(75, Math.min(180, angle));
  return (180 - clamped) / (180 - 75);
}

/**
 * Exact Forward Kinematics matching the nested Three.js group hierarchy.
 */
export function computeForwardKinematics(angles: number[]): ArmJointPositions {
  const { j0, j1, j2, j3 } = servoToRadians(angles);

  const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), j0);
  const q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), j1));
  const q2 = q1.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), j2));
  const q3 = q2.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), j3));

  const shoulder = new THREE.Vector3(0, SHOULDER_Y, 0);

  const elbow = shoulder
    .clone()
    .add(new THREE.Vector3(0, ARM_LINKS.upperArmLength, 0).applyQuaternion(q1));

  const wrist = elbow
    .clone()
    .add(new THREE.Vector3(0, ARM_LINKS.forearmLength, 0).applyQuaternion(q2));

  const tip = wrist
    .clone()
    .add(new THREE.Vector3(0, ARM_LINKS.wristToTipLength, 0).applyQuaternion(q3));

  return { shoulder, elbow, wrist, tip };
}
