import { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  GripHorizontal,
  PictureInPicture2,
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
const MIN_H = 192;

export function CameraPanel({ open, available, streamUrl, onClose }: CameraPanelProps) {
  const [pos, setPos] = useState({ x: 24, y: 72 });
  const [size, setSize] = useState({ width: 384, height: 256 });
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
      'arm-controller-camera',
      `width=${Math.round(size.width)},height=${Math.round(size.height)},resizable=yes`
    );

    if (!win) {
      setPoppedOut(false);
      return;
    }

    popupRef.current = win;
    win.document.title = 'Camera feed — Arm Controller';
    win.document.body.style.margin = '0';
    win.document.body.style.background = '#0f0f10';
    win.document.body.style.color = '#ededed';
    win.document.body.style.fontFamily = "'IBM Plex Sans', system-ui, sans-serif";
    win.document.body.style.height = '100vh';
    win.document.body.style.display = 'flex';
    win.document.body.style.alignItems = 'center';
    win.document.body.style.justifyContent = 'center';

    if (available && streamUrl) {
      win.document.body.innerHTML = `<img src="${streamUrl}" alt="Camera stream" style="width:100%;height:100%;object-fit:contain;" />`;
    } else {
      win.document.body.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <div style="font-size:14px;font-weight:500;color:#a1a1a6;">Camera offline</div>
          <div style="font-size:12px;color:#85858b;margin-top:8px;">Close this window to return to Arm Controller</div>
        </div>
      `;
    }

    const handleBeforeUnload = () => setPoppedOut(false);
    win.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      win.removeEventListener('beforeunload', handleBeforeUnload);
      if (!win.closed) {
        win.close();
      }
    };
  }, [poppedOut, available, streamUrl]);

  if (!open) return null;

  if (poppedOut) {
    return (
      <div
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-50 flex items-center gap-3 rounded-xl border border-[rgba(237,237,237,0.12)] bg-[#19191b] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      >
        <span className="text-xs text-[#a1a1a6]">Camera popped out</span>
        <button
          type="button"
          onClick={() => setPoppedOut(false)}
          className="inline-flex h-7 items-center gap-2 rounded-md border border-[rgba(237,237,237,0.12)] bg-[#232325] px-2 text-xs font-medium text-[#ededed] transition-colors duration-150 hover:bg-[#2c2c30]"
        >
          <PictureInPicture2 size={14} strokeWidth={1.5} className="text-[#a1a1a6]" />
          Pop in
        </button>
        <button
          type="button"
          onClick={() => {
            setPoppedOut(false);
            onClose();
          }}
          aria-label="Close camera"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#85858b] transition-colors duration-150 hover:bg-[#232325] hover:text-[#ededed]"
        >
          <X size={16} strokeWidth={1.5} />
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
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-[rgba(237,237,237,0.12)] bg-[#19191b] shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
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
        className="flex h-10 shrink-0 cursor-move select-none items-center justify-between border-b border-[rgba(237,237,237,0.08)] bg-[#141415] px-3"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={16} strokeWidth={1.5} className="text-[#85858b]" />
          <span className="text-xs font-medium text-[#ededed]">Camera feed</span>
          <span className="font-mono text-xs text-[#85858b]">
            {available ? 'Live' : 'Standby'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPoppedOut(true)}
            title="Pop out into separate window"
            aria-label="Pop out camera window"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#85858b] transition-colors duration-150 hover:bg-[#232325] hover:text-[#ededed]"
          >
            <ExternalLink size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close camera window"
            aria-label="Close camera window"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#85858b] transition-colors duration-150 hover:bg-[#232325] hover:text-[#ededed]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Camera Content */}
      <div className="relative flex flex-1 min-h-0 items-center justify-center bg-[#0f0f10] p-4">
        {available && streamUrl ? (
          <img
            src={streamUrl}
            alt="Raspberry Pi camera stream"
            className="h-full w-full rounded-lg object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <VideoOff size={18} strokeWidth={1.5} className="mb-2 text-[#85858b]" />
            <p className="text-xs font-medium text-[#a1a1a6]">Camera offline</p>
            <p className="mt-1 text-xs text-[#85858b]">
              Connect a Raspberry Pi edge node to stream video
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
            className="h-4 w-4 text-[#85858b] transition-colors duration-150 hover:text-[#ededed]"
            fill="currentColor"
          >
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
