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
    <div className="flex h-full flex-col rounded-xl border border-[rgba(237,237,237,0.08)] bg-[#19191b] p-3">
      {/* Header */}
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="text-sm font-medium text-[#ededed]">Joint controls</h2>
        {locked ? (
          <span className="rounded bg-[#e5484d]/15 px-2 py-0.5 text-xs font-medium text-[#e5484d]">
            {state === 'ESTOPPED' ? 'E-stopped' : 'Offline'}
          </span>
        ) : spatialMode ? (
          <span className="rounded border border-[rgba(237,237,237,0.08)] bg-[#232325] px-2 py-0.5 text-xs font-medium text-[#e5a93c]">
            Spatial IK
          </span>
        ) : (
          <span className="font-mono text-xs text-[#85858b]">6 axes</span>
        )}
      </div>

      {/* Motion Speed Control */}
      <div className="mb-3 shrink-0 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#141415] px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[#a1a1a6]">Motion speed</span>
          <span className="font-mono tabular-nums text-[#ededed]">
            {speedDps.toFixed(0)} °/s
          </span>
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

      {/* Column Legend */}
      <div className="mb-1 flex shrink-0 items-center justify-between px-0.5 text-xs text-[#85858b]">
        <span>Axis</span>
        <div className="flex items-center gap-3 font-mono">
          <span className="w-14 text-right">Live</span>
          <span className="w-14 text-right">Target</span>
        </div>
      </div>

      {/* 6 Joint Rows distributed cleanly to fit without scrolling */}
      <div className="flex flex-1 min-h-0 flex-col justify-between gap-1">
        {joints.map((joint, idx) => {
          const targetVal = angles[idx] ?? joint.home_angle;
          const liveVal = liveAngles[idx] ?? joint.home_angle;
          const range = joint.max_angle - joint.min_angle;
          const homePct =
            range > 0 ? ((joint.home_angle - joint.min_angle) / range) * 100 : 50;

          return (
            <div
              key={joint.id}
              className="flex flex-col justify-center border-t border-[rgba(237,237,237,0.06)] pt-2 first:border-t-0 first:pt-0"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[rgba(237,237,237,0.08)] bg-[#232325] font-mono text-xs text-[#a1a1a6]">
                    J{joint.id}
                  </span>
                  <span className="truncate font-medium text-[#ededed]">
                    {joint.name}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3 font-mono tabular-nums">
                  <span className="w-14 text-right text-[#a1a1a6]">
                    {liveVal.toFixed(1)}°
                  </span>
                  <span className="w-14 text-right text-[#ededed]">
                    {targetVal.toFixed(1)}°
                  </span>
                </div>
              </div>

              {/* Slider track with machined home-position tick mark */}
              <div className="relative flex items-center py-1">
                <span
                  aria-hidden="true"
                  title={`Home: ${joint.home_angle}°`}
                  style={{ left: `${homePct}%` }}
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-[rgba(237,237,237,0.22)]"
                />
                <input
                  type="range"
                  min={joint.min_angle}
                  max={joint.max_angle}
                  step={1}
                  value={targetVal}
                  disabled={locked}
                  aria-label={`${joint.name} angle (${joint.min_angle}° to ${joint.max_angle}°)`}
                  onChange={(e) => onAngleChange(idx, Number(e.target.value))}
                  className="arm-slider relative z-10 w-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
