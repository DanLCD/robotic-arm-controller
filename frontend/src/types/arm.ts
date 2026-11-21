export type ArmState = 'DISCONNECTED' | 'READY' | 'MOVING' | 'ESTOPPED';
export type DriverType = 'mock' | 'serial' | 'pi_edge';

export interface JointConfig {
  id: number;
  name: string;
  min_angle: number;
  max_angle: number;
  home_angle: number;
}

export interface ArmTelemetry {
  type: 'telemetry';
  angles: number[];
  targets: number[];
  speed_dps: number;
  state: ArmState;
  driver: DriverType;
  port: string | null;
  camera_available: boolean;
  timestamp: number;
}

export interface StatusMessage {
  type: 'status' | 'error';
  message: string;
  driver?: DriverType;
}

export interface SerialPortInfo {
  device: string;
  description: string;
  hwid: string;
}

export const DEFAULT_JOINTS: JointConfig[] = [
  { id: 0, name: 'Base', min_angle: 0, max_angle: 180, home_angle: 90 },
  { id: 1, name: 'Shoulder', min_angle: 0, max_angle: 180, home_angle: 130 },
  { id: 2, name: 'Elbow', min_angle: 0, max_angle: 180, home_angle: 180 },
  { id: 3, name: 'Wrist Pitch', min_angle: 0, max_angle: 180, home_angle: 0 },
  { id: 4, name: 'Wrist Roll', min_angle: 0, max_angle: 180, home_angle: 90 },
  { id: 5, name: 'Gripper', min_angle: 75, max_angle: 180, home_angle: 75 },
];
