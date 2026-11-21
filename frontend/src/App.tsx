import { useCallback, useEffect, useRef, useState } from 'react';
import { Arm3DViewport, type ControlMode } from './components/Arm3DViewport';
import { CameraPanel } from './components/CameraPanel';
import { JointControls } from './components/JointControls';
import { TopBar } from './components/TopBar';
import { useArmSocket } from './hooks/useArmSocket';
import type { IKSolution } from './kinematics/ikSolver';
import { DEFAULT_JOINTS } from './types/arm';

const INITIAL_ANGLES = DEFAULT_JOINTS.map((j) => j.home_angle);
const SPATIAL_SEND_THROTTLE_MS = 80; // ~12 Hz max while dragging

export function App() {
  const {
    connected,
    telemetry,
    lastLog,
    ports,
    refreshPorts,
    sendJoints,
    sendHome,
    sendEstop,
    sendReset,
    switchDriver,
  } = useArmSocket();

  const [targetAngles, setTargetAngles] = useState<number[]>(INITIAL_ANGLES);
  const [speedDps, setSpeedDps] = useState<number>(45);
  const [controlMode, setControlMode] = useState<ControlMode>('joint');
  const [liveSync, setLiveSync] = useState<boolean>(true);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const lastSpatialSendRef = useRef<number>(0);

  const liveAngles = telemetry?.angles ?? INITIAL_ANGLES;
  const armState = telemetry?.state ?? 'DISCONNECTED';
  const driver = telemetry?.driver ?? 'mock';
  const locked = !connected || armState === 'ESTOPPED' || armState === 'DISCONNECTED';

  useEffect(() => {
    if (telemetry?.targets && telemetry.state === 'ESTOPPED') {
      setTargetAngles(telemetry.targets);
    }
  }, [telemetry]);

  const handleAngleChange = (index: number, value: number) => {
    const next = [...targetAngles];
    next[index] = value;
    setTargetAngles(next);
    sendJoints(next, speedDps);
  };

  const handleSpeedChange = (speed: number) => {
    setSpeedDps(speed);
    sendJoints(targetAngles, speed);
  };

  const handleHome = () => {
    setTargetAngles(INITIAL_ANGLES);
    sendHome();
  };

  const handleSpatialSolve = useCallback(
    (solution: IKSolution, isFinal: boolean) => {
      setTargetAngles(solution.angles);
      if (!liveSync) return;

      const now = performance.now();
      if (isFinal || now - lastSpatialSendRef.current >= SPATIAL_SEND_THROTTLE_MS) {
        lastSpatialSendRef.current = now;
        sendJoints(solution.angles, speedDps);
      }
    },
    [liveSync, sendJoints, speedDps]
  );

  const viewportAngles =
    controlMode === 'spatial' && !liveSync ? targetAngles : liveAngles;

  return (
    <div className="flex min-h-screen flex-col bg-[#141415] text-[#ededed] lg:h-screen lg:overflow-hidden">
      <TopBar
        connected={connected}
        state={armState}
        driver={driver}
        activePort={telemetry?.port ?? null}
        ports={ports}
        controlMode={controlMode}
        cameraOpen={cameraOpen}
        cameraAvailable={telemetry?.camera_available ?? false}
        onControlModeChange={setControlMode}
        onToggleCamera={() => setCameraOpen((v) => !v)}
        onRefreshPorts={refreshPorts}
        onSwitchDriver={switchDriver}
        onHome={handleHome}
        onEstop={sendEstop}
        onReset={sendReset}
      />

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 min-h-0 flex-col gap-3 p-4 lg:flex-row">
        {/* Main Stage: Full-Height 3D Viewport + Status Bar */}
        <section className="flex flex-1 min-h-0 flex-col gap-3">
          <div className="flex-1 min-h-0">
            <Arm3DViewport
              angles={viewportAngles}
              state={armState}
              controlMode={controlMode}
              locked={locked}
              liveSync={liveSync}
              onLiveSyncChange={setLiveSync}
              onSendPose={() => sendJoints(targetAngles, speedDps)}
              onSpatialSolve={handleSpatialSolve}
            />
          </div>

          {/* Quiet Status Bar pinned below viewport */}
          <div className="flex h-10 shrink-0 items-center justify-between gap-4 rounded-xl border border-[rgba(237,237,237,0.08)] bg-[#19191b] px-4 text-xs">
            <div className="truncate font-mono">
              {lastLog ? (
                <span
                  style={{
                    color: lastLog.type === 'error' ? '#e5484d' : '#a1a1a6',
                  }}
                >
                  {lastLog.message}
                </span>
              ) : (
                <span className="text-[#85858b]">Telemetry 20 Hz</span>
              )}
            </div>
            <span className="hidden shrink-0 font-mono tabular-nums text-[#a1a1a6] sm:inline">
              {liveAngles.map((a, i) => `J${i} ${a.toFixed(1)}°`).join('  ·  ')}
            </span>
          </div>
        </section>

        {/* Fixed-Width Right Sidebar: Joint Controls */}
        <aside className="min-h-0 w-full shrink-0 lg:w-[320px]">
          <JointControls
            angles={targetAngles}
            liveAngles={liveAngles}
            speedDps={speedDps}
            state={armState}
            connected={connected}
            spatialMode={controlMode === 'spatial'}
            onAngleChange={handleAngleChange}
            onSpeedChange={handleSpeedChange}
          />
        </aside>
      </main>

      {/* Floating Draggable / Resizable / Pop-Out Camera Window */}
      <CameraPanel
        open={cameraOpen}
        available={telemetry?.camera_available ?? false}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}

export default App;
