import { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  GripHorizontal,
  PictureInPicture2,
  Video,
  VideoOff,
  X,
} from 'lucide-react';

interface CameraPanelProps {
  open: boolean;
  available: boolean;
  streamUrl?: string | null;
  onClose: () => void;
}

const MIN_W = 280;
const MIN_H = 190;

export function CameraPanel({ open, available, streamUrl, onClose }: CameraPanelProps) {
  const [pos, setPos] = useState({ x: 24, y: 76 });
  const [size, setSize] = useState({ width: 380, height: 250 });
  const [poppedOut, setPoppedOut] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const dragStateRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Pointer drag/resize handlers
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (drag.mode === 'move') {
        const maxX = Math.max(0, window.innerWidth - drag.origW);
        const maxY = Math.max(0, window.innerHeight - drag.origH);
        setPos({
          x: Math.max(0, Math.min(maxX, drag.origX + dx)),
          y: Math.max(0, Math.min(maxY, drag.origY + dy)),
        });
      } else {
        const maxW = Math.min(window.innerWidth * 0.85, window.innerWidth - drag.origX);
        const maxH = Math.min(window.innerHeight * 0.8, window.innerHeight - drag.origY);
        setSize({
          width: Math.max(MIN_W, Math.min(maxW, drag.origW + dx)),
          height: Math.max(MIN_H, Math.min(maxH, drag.origH + dy)),
        });
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Keep external popped-out window synced & clean up on unmount/close
  useEffect(() => {
    if (!poppedOut) {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
      return;
    }

    const win = window.open(
      '',
      'robotic-arm-camera-feed',
      `width=${Math.round(size.width)},height=${Math.round(size.height)},resizable=yes`
    );

    if (!win) {
      // Popup blocked by browser; stay in-app
      setPoppedOut(false);
      return;
    }

    popupRef.current = win;
    win.document.title = 'Robotic Arm — Camera Feed';
    win.document.body.style.margin = '0';
    win.document.body.style.background = '#090d16';
    win.document.body.style.color = '#e2e8f0';
    win.document.body.style.fontFamily = 'system-ui, sans-serif';
    win.document.body.style.height = '100vh';
    win.document.body.style.display = 'flex';
    win.document.body.style.flexDirection = 'column';
    win.document.body.style.alignItems = 'center';
    win.document.body.style.justifyContent = 'center';

    if (available && streamUrl) {
      win.document.body.innerHTML = `<img src="${streamUrl}" alt="Raspberry Pi Camera Stream" style="width:100%;height:100%;object-fit:contain;" />`;
    } else {
      win.document.body.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <div style="font-size:14px;font-weight:600;color:#94a3b8;">Raspberry Pi Camera Stream Offline</div>
          <div style="font-size:12px;color:#64748b;margin-top:6px;">Close this window to pop back into Robotic Arm Studio.</div>
        </div>
      `;
    }

    const handleBeforeUnload = () => {
      setPoppedOut(false);
    };
    win.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      win.removeEventListener('beforeunload', handleBeforeUnload);
      if (!win.closed) {
        win.close();
      }
    };
  }, [poppedOut, available, streamUrl]);

  if (!open) return null;

  // Compact banner when popped out to an external browser window
  if (poppedOut) {
    return (
      <div
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-50 flex items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900/95 px-3.5 py-2 shadow-2xl backdrop-blur"
      >
        <Video className="h-4 w-4 text-sky-400" />
        <span className="text-xs font-medium text-slate-200">Camera popped out</span>
        <button
          type="button"
          onClick={() => setPoppedOut(false)}
          className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/30"
        >
          <PictureInPicture2 className="h-3.5 w-3.5" />
          Pop In
        </button>
        <button
          type="button"
          onClick={() => {
            setPoppedOut(false);
            onClose();
          }}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
      }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-slate-700/90 bg-slate-900/95 shadow-2xl shadow-black/60 backdrop-blur"
    >
      {/* Draggable Title Bar */}
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragStateRef.current = {
            mode: 'move',
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x,
            origY: pos.y,
            origW: size.width,
            origH: size.height,
          };
        }}
        className="flex shrink-0 cursor-move select-none items-center justify-between border-b border-slate-800 bg-slate-950/90 px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-slate-500" />
          <Video className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Camera Feed
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              available
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {available ? 'LIVE' : 'Standby'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPoppedOut(true)}
            title="Pop out into separate window"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Camera Window"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Camera Content */}
      <div className="relative flex flex-1 min-h-0 items-center justify-center bg-slate-950/80 p-3">
        {available && streamUrl ? (
          <img
            src={streamUrl}
            alt="Raspberry Pi Camera Stream"
            className="h-full w-full rounded-lg object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-3">
            <VideoOff className="mb-2 h-6 w-6 text-slate-600" />
            <p className="text-xs font-medium text-slate-400">
              Raspberry Pi Camera Stream Offline
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Drag header to move • Drag corner to resize • Pop out for a 2nd monitor.
            </p>
          </div>
        )}

        {/* Bottom-Right Resize Grip */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            dragStateRef.current = {
              mode: 'resize',
              startX: e.clientX,
              startY: e.clientY,
              origX: pos.x,
              origY: pos.y,
              origW: size.width,
              origH: size.height,
            };
          }}
          title="Drag to resize"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 text-slate-500 hover:text-sky-400"
            fill="currentColor"
          >
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
