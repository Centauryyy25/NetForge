export interface MikroTikResult<T = Record<string, string>> {
  success: boolean;
  data?: T[];
  error?: string;
}

export interface PPPoESecret {
  ".id": string;
  name: string;
  password: string;
  service: string;
  profile: string;
  disabled: string;
}

export interface PPPoEActiveConnection {
  ".id": string;
  name: string;
  service: string;
  "caller-id": string;
  address: string;
  uptime: string;
  encoding: string;
}

export interface SimpleQueue {
  ".id": string;
  name: string;
  target: string;
  "max-limit": string;
  "burst-limit": string;
  "burst-threshold": string;
  "burst-time": string;
  bytes: string;
  packets: string;
  disabled: string;
}

export interface InterfaceTraffic {
  name: string;
  "rx-byte": string;
  "tx-byte": string;
  "rx-packet": string;
  "tx-packet": string;
}
