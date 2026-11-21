import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArmTelemetry, DriverType, SerialPortInfo, StatusMessage } from '../types/arm';

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/arm`;

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export function useArmSocket() {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<ArmTelemetry | null>(null);
  const [lastLog, setLastLog] = useState<StatusMessage | null>(null);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const refreshPorts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ports`);
      if (res.ok) {
        const data: SerialPortInfo[] = await res.json();
        setPorts(data);
      }
    } catch {
      // Backend might be restarting; ignore silently
    }
  }, []);

  useEffect(() => {
    let active = true;
    let attempt = 0;

    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        attempt = 0;
        setConnected(true);
        void refreshPorts();
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as ArmTelemetry | StatusMessage;
          if (data.type === 'telemetry') {
            setTelemetry(data);
          } else if (data.type === 'status' || data.type === 'error') {
            setLastLog(data);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
        const delayMs = Math.min(5000, 500 * 2 ** attempt);
        attempt += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delayMs);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [refreshPorts]);

  const sendPayload = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const sendJoints = useCallback(
    (angles: number[], speedDps: number) => {
      sendPayload({ type: 'set_joints', angles, speed_dps: speedDps });
    },
    [sendPayload]
  );

  const sendHome = useCallback(() => {
    sendPayload({ type: 'home' });
  }, [sendPayload]);

  const sendEstop = useCallback(() => {
    sendPayload({ type: 'estop' });
  }, [sendPayload]);

  const sendReset = useCallback(() => {
    sendPayload({ type: 'reset' });
  }, [sendPayload]);

  const switchDriver = useCallback(
    (driver: DriverType, port?: string, piUrl?: string) => {
      sendPayload({
        type: 'switch_driver',
        driver,
        port: port ?? null,
        pi_url: piUrl ?? null,
      });
    },
    [sendPayload]
  );

  return {
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
  };
}
