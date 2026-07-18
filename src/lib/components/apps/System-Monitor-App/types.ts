export const MAX_HISTORY = 60;

export interface HistPoint { t: number; v: number; }

export type MonitorTab = 'overview' | 'cpu' | 'memory' | 'gpu' | 'network' | 'disk' | 'temperatures' | 'processes';
export type SortKey = 'pid' | 'name' | 'cpu' | 'memory' | 'user';

export interface ProcessEntry {
  pid: number; ppid: number; name: string; cmd: string; user: string;
  cpu: number; memory: number; mem_pct: number; status: string; threads: number;
}

export interface CpuCore { id: number; usage: number; freq?: number; }

export interface CpuInfo {
  total_usage: number; model: string; cores: CpuCore[];
  load_avg_1: number; load_avg_5: number; load_avg_15: number;
}

export interface MemInfo {
  total: number; used: number; free: number; available: number;
  cached: number; buffers: number; swap_total: number; swap_used: number; swap_free: number;
}

export interface DiskEntry {
  name: string; mount: string; fs: string; total: number; used: number; free: number;
  read_bps: number; write_bps: number;
}

export interface NetInterface {
  name: string; rx_bytes: number; tx_bytes: number; rx_bps: number; tx_bps: number;
  ip4?: string; ip6?: string; connected: boolean;
}

export interface GpuInfo {
  name: string; driver: string; usage_pct?: number; vram_used?: number;
  vram_total?: number; temp_c?: number; power_w?: number;
}

export interface TempSensor { label: string; input: number; high?: number; crit?: number; }

export function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

export function fmtBps(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} KB/s`;
  return `${bps} B/s`;
}

export function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0;
}

export function push(arr: HistPoint[], v: number): HistPoint[] {
  return [...arr.slice(-(MAX_HISTORY - 1)), { t: Date.now(), v }];
}
