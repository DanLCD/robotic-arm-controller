import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';
import { Send } from 'lucide-react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ArmState } from '../types/arm';
import {
  ARM_LINKS,
  computeForwardKinematics,
  servoToRadians,
} from '../kinematics/armModel';
import { solveIKForAnchor, type AnchorId, type IKSolution } from '../kinematics/ikSolver';
import { MechanicalClaw } from './MechanicalClaw';

export type ControlMode = 'joint' | 'spatial';

interface Arm3DViewportProps {
  angles: number[];
  state: ArmState;
  controlMode: ControlMode;
  locked: boolean;
  liveSync: boolean;
  onLiveSyncChange: (enabled: boolean) => void;
  onSendPose: () => void;
  onSpatialSolve: (solution: IKSolution, isFinal: boolean) => void;
}

const BLACK_ALUMINUM = '#1a1f29';
const SERVO_BODY = '#0f141d';
const BRACKET_METAL = '#232a36';
const SILVER_TUBE = '#d8e0ea';
const SILVER_HORN = '#cbd5e1';
const RED_WASHER = '#dc2626';

/** Standard heavy-duty servo block (MG996R / DS3218 proportions) */
function HeavyDutyServo({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  accentColor,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  accentColor: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Main servo housing */}
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.4, 0.22]} />
        <meshStandardMaterial color={SERVO_BODY} metalness={0.35} roughness={0.55} />
      </mesh>
      {/* Mounting tabs */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.52, 0.04, 0.22]} />
        <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Status accent strip */}
      <mesh position={[0, -0.14, 0.115]}>
        <boxGeometry args={[0.26, 0.035, 0.01]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** Silver circular aluminum servo horn + bearing hub on Z pivot */
function PivotHardware({ width = 0.44 }: { width?: number }) {
  const half = width / 2;
  return (
    <group>
      {/* Front silver servo horn disc */}
      <mesh position={[0, 0, half]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.04, 24]} />
        <meshStandardMaterial color={SILVER_HORN} metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Rear flanged ball bearing */}
      <mesh position={[0, 0, -half]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 24]} />
        <meshStandardMaterial color={SILVER_HORN} metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Hollow black anodized aluminum U-bracket arm link */
function AluminumUBracket({ length, width = 0.42 }: { length: number; width?: number }) {
  const half = width / 2;
  return (
    <group>
      {/* Front wall */}
      <mesh position={[0, length / 2, half]} castShadow>
        <boxGeometry args={[0.26, length, 0.035]} />
        <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Rear wall */}
      <mesh position={[0, length / 2, -half]} castShadow>
        <boxGeometry args={[0.26, length, 0.035]} />
        <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Mid crossbar bridge (where the two U-brackets bolt together) */}
      <mesh position={[0, length / 2, 0]} castShadow>
        <boxGeometry args={[0.24, 0.04, width - 0.03]} />
        <meshStandardMaterial color={BRACKET_METAL} metalness={0.55} roughness={0.4} />
      </mesh>
    </group>
  );
}

function RealisticArmModel({ angles, state }: { angles: number[]; state: ArmState }) {
  const { j0, j1, j2, j3, j4 } = servoToRadians(angles);
  const gripperAngle = angles[5] ?? 90;

  const accentColor =
    state === 'ESTOPPED'
      ? '#e5484d'
      : state === 'MOVING'
        ? '#e5a93c'
        : '#4cc38a';

  return (
    <group position={[0, 0, 0]}>
      {/* Twin-Plate Black Anodized Base (9 cm x 8.4 cm) */}
      <group>
        {/* Bottom mounting plate */}
        <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.92, 0.04, 0.86]} />
          <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Upper mounting deck */}
        <mesh position={[0, ARM_LINKS.basePlateHeight - 0.02, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.92, 0.04, 0.86]} />
          <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Center U-channel vertical webs connecting base plates */}
        <mesh position={[-0.14, ARM_LINKS.basePlateHeight / 2, 0]} castShadow>
          <boxGeometry args={[0.04, ARM_LINKS.basePlateHeight - 0.04, 0.82]} />
          <meshStandardMaterial color={BRACKET_METAL} metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0.14, ARM_LINKS.basePlateHeight / 2, 0]} castShadow>
          <boxGeometry args={[0.04, ARM_LINKS.basePlateHeight - 0.04, 0.82]} />
          <meshStandardMaterial color={BRACKET_METAL} metalness={0.55} roughness={0.4} />
        </mesh>
        {/* Red anodized corner washers (signature detail from photos) */}
        {[
          [-0.22, ARM_LINKS.basePlateHeight + 0.01, -0.18],
          [0.22, ARM_LINKS.basePlateHeight + 0.01, -0.18],
          [-0.22, ARM_LINKS.basePlateHeight + 0.01, 0.18],
          [0.22, ARM_LINKS.basePlateHeight + 0.01, 0.18],
        ].map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.032, 0.032, 0.02, 12]} />
            <meshStandardMaterial color={RED_WASHER} metalness={0.5} roughness={0.3} />
          </mesh>
        ))}
        {/* Fixed J0 Base Servo */}
        <HeavyDutyServo
          position={[0, ARM_LINKS.basePlateHeight + 0.16, 0]}
          accentColor={accentColor}
        />
      </group>

      {/* J0: Rotating Base Turret */}
      <group position={[0, ARM_LINKS.basePlateHeight + ARM_LINKS.turretHeight, 0]} rotation={[0, j0, 0]}>
        {/* Silver circular J0 servo horn */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
          <meshStandardMaterial color={SILVER_HORN} metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Multi-function shoulder servo bracket */}
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.46, 0.24, 0.34]} />
          <meshStandardMaterial color={BRACKET_METAL} metalness={0.55} roughness={0.4} />
        </mesh>

        {/* J1: Shoulder Pivot */}
        <group position={[0, ARM_LINKS.shoulderOffsetY, 0]} rotation={[0, 0, j1]}>
          <HeavyDutyServo rotation={[0, Math.PI / 2, 0]} accentColor={accentColor} />
          <PivotHardware width={0.46} />

          {/* Upper Arm: Dual Black Aluminum U-Brackets */}
          <AluminumUBracket length={ARM_LINKS.upperArmLength} width={0.44} />

          {/* J2: Elbow Pivot */}
          <group position={[0, ARM_LINKS.upperArmLength, 0]} rotation={[0, 0, j2]}>
            <HeavyDutyServo rotation={[0, Math.PI / 2, 0]} accentColor={accentColor} />
            <PivotHardware width={0.44} />

            {/* Forearm: Polished Silver Cylindrical Aluminum Tube */}
            <group>
              {/* Lower mounting flange */}
              <mesh position={[0, 0.16, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 0.05, 24]} />
                <meshStandardMaterial color={SILVER_HORN} metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Cylindrical aluminum rod */}
              <mesh position={[0, ARM_LINKS.forearmLength / 2, 0]} castShadow>
                <cylinderGeometry args={[0.085, 0.085, ARM_LINKS.forearmLength - 0.28, 24]} />
                <meshStandardMaterial color={SILVER_TUBE} metalness={0.9} roughness={0.18} />
              </mesh>
              {/* Upper mounting flange */}
              <mesh position={[0, ARM_LINKS.forearmLength - 0.16, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.15, 0.05, 24]} />
                <meshStandardMaterial color={SILVER_HORN} metalness={0.85} roughness={0.2} />
              </mesh>
            </group>

            {/* J3: Wrist Pitch Pivot */}
            <group position={[0, ARM_LINKS.forearmLength, 0]} rotation={[0, 0, j3]}>
              <HeavyDutyServo rotation={[0, Math.PI / 2, 0]} accentColor={accentColor} />
              <PivotHardware width={0.42} />

              {/* Wrist U-Bracket Housing the Axial J4 Servo */}
              <AluminumUBracket length={0.56} width={0.4} />
              <mesh position={[0, 0.56, 0]} castShadow>
                <boxGeometry args={[0.28, 0.04, 0.42]} />
                <meshStandardMaterial color={BLACK_ALUMINUM} metalness={0.6} roughness={0.35} />
              </mesh>

              {/* Axial J4 Wrist-Roll Servo inside the U-bracket */}
              <HeavyDutyServo
                position={[0, 0.34, 0]}
                rotation={[0, 0, 0]}
                accentColor={accentColor}
              />

              {/* J4: Wrist Roll + J5: Geared 4-Bar Mechanical Claw */}
              <group position={[0, 0.58, 0]} rotation={[0, j4, 0]}>
                <MechanicalClaw gripperAngle={gripperAngle} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

interface SpatialGizmoLayerProps {
  angles: number[];
  activeAnchor: AnchorId;
  locked: boolean;
  onSelectAnchor: (anchor: AnchorId) => void;
  onDraggingChange: (dragging: boolean) => void;
  onSolve: (solution: IKSolution, isFinal: boolean) => void;
}

const ANCHOR_META: { id: AnchorId; label: string; color: string }[] = [
  { id: 'elbow', label: 'J2 Elbow', color: '#a1a1a6' },
  { id: 'wrist', label: 'J3 Wrist', color: '#ededed' },
  { id: 'tip', label: 'Claw tip', color: '#e5a93c' },
];

function SpatialGizmoLayer({
  angles,
  activeAnchor,
  locked,
  onSelectAnchor,
  onDraggingChange,
  onSolve,
}: SpatialGizmoLayerProps) {
  const fk = useMemo(() => computeForwardKinematics(angles), [angles]);
  const [handleObj, setHandleObj] = useState<THREE.Group | null>(null);
  const isDraggingRef = useRef(false);
  const latestSolutionRef = useRef<IKSolution | null>(null);
  const anglesRef = useRef(angles);
  anglesRef.current = angles;

  // Keep the draggable handle synced with the selected joint anchor when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current && handleObj) {
      handleObj.position.copy(fk[activeAnchor]);
    }
  }, [fk, activeAnchor, handleObj]);

  return (
    <group>
      {/* Clickable glowing anchor spheres on Elbow, Wrist, and Claw Tip */}
      {ANCHOR_META.map((item) => {
        const pos = fk[item.id];
        const isActive = activeAnchor === item.id;
        return (
          <mesh
            key={item.id}
            position={[pos.x, pos.y, pos.z]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAnchor(item.id);
            }}
          >
            <sphereGeometry args={[isActive ? 0.13 : 0.095, 20, 20]} />
            <meshStandardMaterial
              color={item.color}
              emissive={item.color}
              emissiveIntensity={isActive ? 1.1 : 0.45}
              transparent
              opacity={isActive ? 0.92 : 0.65}
            />
          </mesh>
        );
      })}

      {/* Draggable TransformControls handle */}
      <group ref={setHandleObj} position={[fk[activeAnchor].x, fk[activeAnchor].y, fk[activeAnchor].z]} />

      {!locked && handleObj && (
        <TransformControls
          object={handleObj}
          mode="translate"
          size={0.75}
          onMouseDown={() => {
            isDraggingRef.current = true;
            onDraggingChange(true);
          }}
          onMouseUp={() => {
            isDraggingRef.current = false;
            onDraggingChange(false);
            if (latestSolutionRef.current) {
              onSolve(latestSolutionRef.current, true);
              latestSolutionRef.current = null;
            }
          }}
          onObjectChange={() => {
            if (!isDraggingRef.current || !handleObj) return;
            const target = handleObj.position.clone();
            const sol = solveIKForAnchor(anglesRef.current, activeAnchor, target);
            latestSolutionRef.current = sol;
            onSolve(sol, false);
          }}
        />
      )}
    </group>
  );
}

export function Arm3DViewport({
  angles,
  state,
  controlMode,
  locked,
  liveSync,
  onLiveSyncChange,
  onSendPose,
  onSpatialSolve,
}: Arm3DViewportProps) {
  const [activeAnchor, setActiveAnchor] = useState<AnchorId>('tip');
  const [isDragging, setIsDragging] = useState(false);
  const [reachable, setReachable] = useState(true);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);

  const fk = useMemo(() => computeForwardKinematics(angles), [angles]);
  const activePos = fk[activeAnchor];

  const handleSolve = (solution: IKSolution, isFinal: boolean) => {
    setReachable(solution.reachable);
    onSpatialSolve(solution, isFinal);
  };

  return (
    <div className="relative h-full w-full min-h-[340px] lg:min-h-0 overflow-hidden rounded-xl border border-[rgba(237,237,237,0.08)] bg-[#0f0f10]">
      {/* Top-Left HUD */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#19191b] px-3 text-xs text-[#a1a1a6]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: controlMode === 'spatial' ? '#e5a93c' : '#85858b',
            }}
          />
          {controlMode === 'spatial'
            ? 'Select an anchor and drag'
            : 'Drag to orbit, scroll to zoom'}
        </div>

        {controlMode === 'spatial' && (
          <div className="flex h-8 items-center gap-3 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#19191b] px-3 font-mono text-xs tabular-nums text-[#ededed]">
            <span>X {(activePos.x * 10).toFixed(1)}</span>
            <span>Y {(activePos.y * 10).toFixed(1)}</span>
            <span>Z {(activePos.z * 10).toFixed(1)} cm</span>
            <span
              className="font-sans text-xs font-medium"
              style={{ color: reachable ? '#4cc38a' : '#e5a93c' }}
            >
              {reachable ? 'Reachable' : 'Clamped'}
            </span>
          </div>
        )}
      </div>

      {/* Bottom-Left Anchor Selector in Spatial Mode */}
      {controlMode === 'spatial' && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#19191b] p-1">
          <span className="px-2 text-xs text-[#85858b]">Anchor</span>
          {ANCHOR_META.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveAnchor(item.id)}
              className={`flex h-7 items-center gap-2 rounded-[5px] px-2.5 text-xs font-medium transition-colors duration-150 ${
                activeAnchor === item.id
                  ? 'bg-[#232325] text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-[#85858b] hover:text-[#ededed]'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Bottom-Right Live Sync & Send Pose HUD in Spatial Mode */}
      {controlMode === 'spatial' && (
        <div className="absolute bottom-4 right-4 z-10 flex h-9 items-center gap-3 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#19191b] px-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-[#a1a1a6]">
            <input
              type="checkbox"
              checked={liveSync}
              onChange={(e) => onLiveSyncChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#e5a93c]"
            />
            Live sync
          </label>
          {!liveSync && (
            <button
              type="button"
              disabled={locked}
              onClick={onSendPose}
              className="inline-flex h-7 items-center gap-2 rounded-md bg-[#e5a93c] px-3 text-xs font-medium text-[#141415] transition-[background-color,transform] duration-150 hover:bg-[#edb854] active:scale-[0.98] disabled:opacity-40"
            >
              <Send size={14} strokeWidth={1.5} />
              Send pose
            </button>
          )}
        </div>
      )}

      <Canvas shadows camera={{ position: [5.4, 4.0, 5.8], fov: 42 }}>
        <color attach="background" args={['#0f0f10']} />
        <hemisphereLight args={['#f4f4f6', '#232325', 0.75]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.55}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-4, 4, -3]} intensity={0.55} color="#ededed" />
        <pointLight position={[3, 2, -4]} intensity={0.4} color="#e5a93c" />

        <RealisticArmModel angles={angles} state={state} />

        {controlMode === 'spatial' && (
          <SpatialGizmoLayer
            angles={angles}
            activeAnchor={activeAnchor}
            locked={locked}
            onSelectAnchor={setActiveAnchor}
            onDraggingChange={setIsDragging}
            onSolve={handleSolve}
          />
        )}

        <Grid
          args={[12, 12]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1f1f22"
          sectionSize={2}
          sectionThickness={0.9}
          sectionColor="#2c2c30"
          fadeDistance={20}
          position={[0, 0, 0]}
        />
        <OrbitControls
          ref={orbitRef}
          makeDefault
          target={[0, 1.75, 0]}
          enabled={!isDragging}
          minDistance={2.5}
          maxDistance={14}
          maxPolarAngle={Math.PI / 2 - 0.03}
        />
      </Canvas>
    </div>
  );
}
