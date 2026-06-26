export interface ProcessEntry { pid: string; name: string; cpu: number; memory: number; }
export interface HistPoint    { t: number; v: number; }
export type MonitorTab = 'overview' | 'processes' | 'resources';
export type SortKey    = 'name' | 'pid' | 'cpu' | 'memory';
export const MAX_HISTORY = 60;
