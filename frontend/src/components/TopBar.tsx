import { useState } from 'react';
import {
  Home,
  Move3d,
  OctagonAlert,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Video,
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

/** Flat 2-bar articulated arm glyph in solid primary text color */
function ArmMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="shrink-0 text-[#ededed]"
      aria-hidden="true"
    >
      <path
        d="M3 15H11M6 15V11L10.5 7.5L14 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="11" r="1.4" fill="currentColor" />
      <circle cx="10.5" cy="7.5" r="1.4" fill="currentColor" />
    </svg>
  );
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

  const statusDotColor = (() => {
    if (!connected || state === 'DISCONNECTED') return '#85858b';
    if (state === 'ESTOPPED') return '#e5484d';
    if (state === 'MOVING') return '#e5a93c';
    return '#4cc38a';
  })();

  const statusLabel = (() => {
    if (!connected) return 'Reconnecting';
    if (state === 'ESTOPPED') return 'E-stopped';
    if (state === 'MOVING') return 'Moving';
    if (state === 'READY') return 'Ready';
    return 'Offline';
  })();

  const effectivePort = selectedPort || ports[0]?.device || '';

  return (
    <header className="shrink-0 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[rgba(237,237,237,0.08)] bg-[#19191b] px-4 py-2">
      {/* Left: Flat Wordmark + Quiet Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <ArmMark />
          <h1 className="text-[15px] font-medium text-[#ededed]">Arm Controller</h1>
        </div>

        <span className="h-4 w-px bg-[rgba(237,237,237,0.08)]" />

        <div className="flex items-center gap-2 text-xs text-[#a1a1a6]">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: statusDotColor }}
          />
          <span className="font-medium text-[#ededed]">{statusLabel}</span>
          {activePort && (
            <span className="font-mono text-[#85858b]">{activePort}</span>
          )}
        </div>
      </div>

      {/* Center: Mode Switcher + Camera Window Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 items-center rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#141415] p-1">
          <button
            type="button"
            onClick={() => onControlModeChange('joint')}
            className={`inline-flex h-6 items-center gap-2 rounded-[5px] px-3 text-xs font-medium transition-colors duration-150 ${
              controlMode === 'joint'
                ? 'bg-[#232325] text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-[#85858b] hover:text-[#ededed]'
            }`}
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} />
            Joint
          </button>
          <button
            type="button"
            onClick={() => onControlModeChange('spatial')}
            className={`inline-flex h-6 items-center gap-2 rounded-[5px] px-3 text-xs font-medium transition-colors duration-150 ${
              controlMode === 'spatial'
                ? 'bg-[#232325] text-[#e5a93c] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-[#85858b] hover:text-[#ededed]'
            }`}
          >
            <Move3d size={14} strokeWidth={1.5} />
            Spatial
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleCamera}
          className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ${
            cameraOpen
              ? 'border-[rgba(237,237,237,0.16)] bg-[#232325] text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'border-[rgba(237,237,237,0.08)] bg-[#141415] text-[#a1a1a6] hover:text-[#ededed]'
          }`}
        >
          <Video size={16} strokeWidth={1.5} className="text-[#85858b]" />
          Camera
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: cameraAvailable ? '#4cc38a' : '#85858b' }}
          />
        </button>
      </div>

      {/* Right: Transport & Motion Controls */}
      <div className="flex flex-wrap items-center gap-2">
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
          aria-label="Driver mode"
          className="h-8 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#141415] px-2 text-xs text-[#ededed] transition-colors duration-150 hover:border-[rgba(237,237,237,0.16)] disabled:opacity-40"
        >
          <option value="mock">Simulator</option>
          <option value="serial">Arduino Mega</option>
          <option value="pi_edge" disabled>
            Raspberry Pi (soon)
          </option>
        </select>

        <div className="flex items-center gap-1">
          <select
            value={effectivePort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={!connected || ports.length === 0}
            aria-label="Serial port"
            className="h-8 w-44 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#141415] px-2 font-mono text-xs text-[#ededed] transition-colors duration-150 hover:border-[rgba(237,237,237,0.16)] disabled:opacity-40"
          >
            {ports.length === 0 ? (
              <option value="">No ports</option>
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
            title="Refresh serial ports"
            aria-label="Refresh serial ports"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#141415] text-[#a1a1a6] transition-colors duration-150 hover:border-[rgba(237,237,237,0.16)] hover:text-[#ededed]"
          >
            <RefreshCw size={16} strokeWidth={1.5} />
          </button>
          {driver !== 'serial' && effectivePort && (
            <button
              type="button"
              onClick={() => onSwitchDriver('serial', effectivePort)}
              disabled={!connected}
              className="inline-flex h-8 items-center rounded-lg border border-[rgba(237,237,237,0.16)] bg-[#232325] px-3 text-xs font-medium text-[#ededed] transition-colors duration-150 hover:bg-[#2c2c30] disabled:opacity-40"
            >
              Connect
            </button>
          )}
        </div>

        <span className="hidden h-4 w-px bg-[rgba(237,237,237,0.08)] sm:block" />

        <button
          type="button"
          onClick={onHome}
          disabled={!connected || state === 'ESTOPPED'}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-[rgba(237,237,237,0.08)] bg-[#232325] px-3 text-xs font-medium text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color,transform] duration-150 hover:bg-[#2c2c30] active:scale-[0.98] disabled:opacity-40"
        >
          <Home size={16} strokeWidth={1.5} className="text-[#a1a1a6]" />
          Home
        </button>

        {state === 'ESTOPPED' && (
          <button
            type="button"
            onClick={onReset}
            disabled={!connected}
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#e5a93c] px-3 text-xs font-medium text-[#141415] transition-[background-color,transform] duration-150 hover:bg-[#edb854] active:scale-[0.98] disabled:opacity-40"
          >
            <RotateCcw size={16} strokeWidth={1.5} />
            Reset
          </button>
        )}

        <button
          type="button"
          onClick={onEstop}
          disabled={!connected}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#e5484d] px-3 text-xs font-medium text-[#ededed] transition-[background-color,transform] duration-150 hover:bg-[#ec5d62] active:scale-[0.98] disabled:opacity-40"
        >
          <OctagonAlert size={16} strokeWidth={1.5} />
          E-stop
        </button>
      </div>
    </header>
  );
}
