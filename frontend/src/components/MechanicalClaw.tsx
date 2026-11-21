import { getGripperOpenness } from '../kinematics/armModel';

interface MechanicalClawProps {
  gripperAngle: number;
}

const BLACK_ALUMINUM = '#1a1f29';
const SERVO_BODY = '#11161f';
const SILVER_HARDWARE = '#cbd5e1';
const DARK_STEEL = '#2b3342';

function ClawFinger({ side, crankAngle }: { side: -1 | 1; crankAngle: number }) {
  // side = -1 (left), +1 (right)
  // Crank swings outward by side * -crankAngle around Z:
  //   Left (-1): positive Z rotation swings +Y toward -X (outward left)
  //   Right (+1): negative Z rotation swings +Y toward +X (outward right)
  const rotZ = -side * crankAngle;
  const crankLen = 0.24;

  return (
    <group>
      {/* Interlocking Spur Gear Hub */}
      <group position={[side * 0.095, 0.16, 0]} rotation={[0, 0, rotZ]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.045, 16]} />
          <meshStandardMaterial color={DARK_STEEL} metalness={0.65} roughness={0.35} />
        </mesh>
        {/* Silver gear center bolt */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.028]}>
          <cylinderGeometry args={[0.028, 0.028, 0.02, 12]} />
          <meshStandardMaterial color={SILVER_HARDWARE} metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Outer Crank Arm */}
        <mesh position={[0, crankLen / 2, 0]} castShadow>
          <boxGeometry args={[0.055, crankLen, 0.036]} />
          <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.55} roughness={0.4} />
        </mesh>

        {/* Parallel Jaw Finger (counter-rotated to stay parallel to claw axis) */}
        <group position={[0, crankLen, 0]} rotation={[0, 0, -rotZ]}>
          {/* Pivot bolt */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.055, 12]} />
            <meshStandardMaterial color={SILVER_HARDWARE} metalness={0.85} roughness={0.2} />
          </mesh>

          {/* Main Pincer Blade */}
          <mesh position={[-side * 0.015, 0.2, 0]} castShadow>
            <boxGeometry args={[0.05, 0.42, 0.042]} />
            <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.55} roughness={0.35} />
          </mesh>

          {/* Inward-facing Serrated Grip Tip */}
          <mesh position={[-side * 0.042, 0.37, 0]} castShadow>
            <boxGeometry args={[0.038, 0.1, 0.046]} />
            <meshStandardMaterial color={DARK_STEEL} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[-side * 0.025, 0.39, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.052, 10]} />
            <meshStandardMaterial color={SILVER_HARDWARE} metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Inner Parallel 4-Bar Guide Link */}
      <group position={[side * 0.045, 0.25, 0.022]} rotation={[0, 0, rotZ]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.03, 10]} />
          <meshStandardMaterial color={SILVER_HARDWARE} metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, crankLen / 2, 0]} castShadow>
          <boxGeometry args={[0.032, crankLen, 0.022]} />
          <meshStandardMaterial color={DARK_STEEL} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

export function MechanicalClaw({ gripperAngle }: MechanicalClawProps) {
  // 75° -> openness 1.0 (fully open), 180° -> openness 0.0 (fully closed)
  const openness = getGripperOpenness(gripperAngle);
  const crankAngle = 0.06 + openness * 0.78;

  return (
    <group>
      {/* Silver Circular Servo Horn Collar */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 24]} />
        <meshStandardMaterial color={SILVER_HARDWARE} metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Claw Main Mounting Frame */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[0.34, 0.16, 0.055]} />
        <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.55} roughness={0.4} />
      </mesh>

      {/* Side-Mounted J5 Gripper Servo Body */}
      <group position={[0.11, 0.14, -0.15]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.36, 0.22]} />
          <meshStandardMaterial color={SERVO_BODY} metalness={0.35} roughness={0.55} />
        </mesh>
        {/* Servo mounting flange */}
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[0.26, 0.38, 0.025]} />
          <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Twin 4-Bar Linkage Geared Fingers */}
      <ClawFinger side={-1} crankAngle={crankAngle} />
      <ClawFinger side={1} crankAngle={crankAngle} />
    </group>
  );
}
