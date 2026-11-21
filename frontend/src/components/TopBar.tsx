import { useState } from 'react';
import {
  Cpu,
  Home,
  Move3d,
  OctagonAlert,
  RefreshCw,
  RotateCcw,
  Sliders,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ArmState, DriverType, SerialPortInfo } from '../types/arm';
import type { ControlMode } from './Arm3DViewport';

interface TopBarProps {
  connected: boolean;
  state: ArmState;
  driver: DriverType;
  activePort: string | null;
  ports: SerialPortInfo[];
  controlMode: ControlMode;
  cameraOpen: boolean;
  cameraAvailable: boolean;
  onControlModeChange: (mode: ControlMode) => void;
  onToggleCamera: () => void;
  onRefreshPorts: () => void;
  onSwitchDriver: (driver: DriverType, port?: string) => void;
  onHome: () => void;
  onEstop: () => void;
  onReset: () => void;
}

export function TopBar({
  connected,
  state,
  driver,
  activePort,
  ports,
  controlMode,
  cameraOpen,
  cameraAvailable,
  onControlModeChange,
  onToggleCamera,
  onRefreshPorts,
  onSwitchDriver,
  onHome,
  onEstop,
  onReset,
}: TopBarProps) {
  const [selectedPort, setSelectedPort] = useState<string>(ports[0]?.device ?? '');

  const stateBadge = (() => {
    if (!connected || state === 'DISCONNECTED') {
      return 'bg-slate-800 text-slate-400 border-slate-700';
    }
    if (state === 'ESTOPPED') {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
    if (state === 'MOVING') {
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    }
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  })();

  const effectivePort = selectedPort || ports[0]?.device || '';

  return (
    <header className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur">
      {/* Left: Brand & Connection Status */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
          <Cpu className="h-4.5 w-4.5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-100 leading-tight">
            Robotic Arm Studio
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              {connected ? (
                <Wifi className="h-3 w-3 text-emerald-400" />
              ) : (
                <WifiOff className="h-3 w-3 text-rose-400" />
              )}
              {connected ? 'WS Connected' : 'Reconnecting...'}
            </span>
            <span>•</span>
            <span className={`rounded-full border px-1.5 py-0.25 text-[10px] font-semibold ${stateBadge}`}>
              {state}
            </span>
            {activePort && <span className="font-mono text-slate-400">({activePort})</span>}
          </div>
        </div>
      </div>

      {/* Center: Control Mode Toggle + Camera Popup Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-0.5">
          <button
            type="button"
            onClick={() => onControlModeChange('joint')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              controlMode === 'joint'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Joint Mode
          </button>
          <button
            type="button"
            onClick={() => onControlModeChange('spatial')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              controlMode === 'spatial'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Move3d className="h-3.5 w-3.5" />
            Spatial Mode
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleCamera}
          title={cameraOpen ? 'Hide Camera Window' : 'Open Camera Window'}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            cameraOpen
              ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
              : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          Camera
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              cameraAvailable ? 'bg-emerald-400' : 'bg-slate-500'
            }`}
          />
        </button>
      </div>

      {/* Right: Driver, Port & Safety Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={driver}
          onChange={(e) => {
            const next = e.target.value as DriverType;
            if (next === 'serial') {
              onSwitchDriver('serial', effectivePort);
            } else {
              onSwitchDriver(next);
            }
          }}
          disabled={!connected}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-medium text-slate-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="mock">Mock Simulator</option>
          <option value="serial">Arduino Mega (Serial)</option>
          <option value="pi_edge" disabled>
            Raspberry Pi Edge (Future)
          </option>
        </select>

        <div className="flex items-center gap-1">
          <select
            value={effectivePort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={!connected || ports.length === 0}
            className="max-w-[145px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none disabled:opacity-50"
          >
            {ports.length === 0 ? (
              <option value="">No COM ports</option>
            ) : (
              ports.map((p) => (
                <option key={p.device} value={p.device}>
                  {p.device} — {p.description}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={onRefreshPorts}
            title="Refresh COM ports"
            className="rounded-lg border border-slate-700 bg-slate-950 p-1.5 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {driver !== 'serial' && effectivePort && (
            <button
              type="button"
              onClick={() => onSwitchDriver('serial', effectivePort)}
              disabled={!connected}
              className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/25"
            >
              Connect
            </button>
          )}
        </div>

        <div className="mx-0.5 hidden h-5 w-px bg-slate-800 sm:block" />

        <button
          type="button"
          onClick={onHome}
          disabled={!connected || state === 'ESTOPPED'}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          <Home className="h-3.5 w-3.5" />
          Home
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={!connected || state !== 'ESTOPPED'}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        <button
          type="button"
          onClick={onEstop}
          disabled={!connected}
          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-rose-900/40 hover:bg-rose-500 active:scale-95 disabled:opacity-40"
        >
          <OctagonAlert className="h-3.5 w-3.5" />
          E-Stop
        </button>
      </div>
    </header>
  );
}
