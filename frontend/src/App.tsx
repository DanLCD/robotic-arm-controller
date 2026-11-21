import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
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

  // In Spatial Preview mode (liveSync OFF), show targetAngles in 3D so the user previews before sending
  const viewportAngles =
    controlMode === 'spatial' && !liveSync ? targetAngles : liveAngles;

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden flex-col bg-slate-950 text-slate-100">
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

      <main className="mx-auto grid w-full max-w-[1800px] flex-1 min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-12">
        {/* Left/Center: Full-Height 3D Viewport + Status Bar */}
        <section className="flex min-h-0 flex-col gap-2.5 lg:col-span-8 xl:col-span-9">
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

          {/* Compact Status / Event Bar pinned below viewport */}
          <div className="shrink-0 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs">
            <div className="flex items-center gap-2 font-mono truncate">
              <Terminal className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {lastLog ? (
                <span className={lastLog.type === 'error' ? 'text-rose-400' : 'text-sky-300'}>
                  [{lastLog.type.toUpperCase()}] {lastLog.message}
                </span>
              ) : (
                <span className="text-slate-400">System ready. Telemetry streaming at 20 Hz.</span>
              )}
            </div>
            <span className="hidden shrink-0 font-mono text-slate-400 sm:inline ml-3">
              Angles: [{liveAngles.map((a) => a.toFixed(0)).join(', ')}]°
            </span>
          </div>
        </section>

        {/* Right Sidebar: Joint Sliders */}
        <aside className="min-h-0 lg:col-span-4 xl:col-span-3">
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
