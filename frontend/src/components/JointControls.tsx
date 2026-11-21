import { Gauge, Lock } from 'lucide-react';
import { DEFAULT_JOINTS, type ArmState, type JointConfig } from '../types/arm';

interface JointControlsProps {
  joints?: JointConfig[];
  angles: number[];
  liveAngles: number[];
  speedDps: number;
  state: ArmState;
  connected: boolean;
  spatialMode?: boolean;
  onAngleChange: (index: number, value: number) => void;
  onSpeedChange: (speed: number) => void;
}

export function JointControls({
  joints = DEFAULT_JOINTS,
  angles,
  liveAngles,
  speedDps,
  state,
  connected,
  spatialMode = false,
  onAngleChange,
  onSpeedChange,
}: JointControlsProps) {
  const locked = !connected || state === 'ESTOPPED' || state === 'DISCONNECTED';

  return (
    <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
          Joint Controls (5-DOF + Gripper)
        </h2>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-400">
            <Lock className="h-3 w-3" />
            {state === 'ESTOPPED' ? 'E-STOP LOCKED' : 'OFFLINE'}
          </span>
        ) : spatialMode ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            Driven by Spatial IK
          </span>
        ) : null}
      </div>

      {/* Global Speed Slider */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Gauge className="h-3.5 w-3.5 text-sky-400" />
            Motion Speed
          </span>
          <span className="font-mono text-sky-400">{speedDps.toFixed(0)} °/s</span>
        </div>
        <input
          type="range"
          min={5}
          max={180}
          step={1}
          value={speedDps}
          disabled={locked}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="arm-slider w-full"
        />
      </div>

      {/* 6 Joint Sliders */}
      <div className="space-y-2.5">
        {joints.map((joint, idx) => {
          const targetVal = angles[idx] ?? joint.home_angle;
          const liveVal = liveAngles[idx] ?? joint.home_angle;
          return (
            <div key={joint.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">
                  J{joint.id} · {joint.name}
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400">
                    Live: <span className="text-emerald-400">{liveVal.toFixed(1)}°</span>
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-sky-400">{targetVal.toFixed(0)}°</span>
                </div>
              </div>
              <input
                type="range"
                min={joint.min_angle}
                max={joint.max_angle}
                step={1}
                value={targetVal}
                disabled={locked}
                onChange={(e) => onAngleChange(idx, Number(e.target.value))}
                className="arm-slider w-full"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{joint.min_angle}°</span>
                <span>{joint.max_angle}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
