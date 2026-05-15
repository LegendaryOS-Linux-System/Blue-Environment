export type HkValue = string | number | boolean | HkValue[] | HkMap;
export type HkMap = { [key: string]: HkValue };
export type HkConfig = { [section: string]: HkMap };

export class HkError extends Error {
    constructor(message: string, public line?: number) {
        super(line != null ? `[.hk] line ${line}: ${message}` : `[.hk] ${message}`);
    }
}

// ── Parser ────────────────────────────────────────────────────────────────

export function parseHk(input: string): HkConfig {
    const config: HkConfig = {};
    const lines = input.split('\n');
    let currentSection: string | null = null;
    let currentL1Key: string | null = null;
    let currentL2Key: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();

        // Comment or empty
        if (!line || line.startsWith('!')) continue;

        // Section header [name]
        const sectionMatch = line.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            if (!config[currentSection]) config[currentSection] = {};
            currentL1Key = null;
            currentL2Key = null;
            continue;
        }

        if (!currentSection) continue;

        // Determine depth by counting leading dashes before '>'
        const arrowMatch = line.match(/^(-+)>(?:\s+(.+?)(?:\s+=>\s+(.+))?)?$/);
        if (!arrowMatch) continue;

        const dashes = arrowMatch[1].length;
        const rawKey = arrowMatch[2]?.trim() || '';
        const rawVal = arrowMatch[3]?.trim();

        const depth = dashes; // 1=L1, 2=L2, 3=L3

        if (depth === 1) {
            if (rawVal === undefined) {
                // Inline map declaration
                currentL1Key = rawKey;
                currentL2Key = null;
                setNestedValue(config[currentSection], rawKey.split('.'), {});
            } else {
                // L1 key-value, possibly dot-path
                currentL1Key = null;
                currentL2Key = null;
                const keys = rawKey.includes('.') ? rawKey.split('.') : [rawKey];
                setNestedValue(config[currentSection], keys, parseValue(rawVal, i + 1));
            }
        } else if (depth === 2 && currentL1Key) {
            const l1 = getOrCreate(config[currentSection], currentL1Key);
            if (rawVal === undefined) {
                currentL2Key = rawKey;
                (l1 as HkMap)[rawKey] = {};
            } else {
                currentL2Key = null;
                const keys = rawKey.includes('.') ? rawKey.split('.') : [rawKey];
                setNestedValue(l1 as HkMap, keys, parseValue(rawVal, i + 1));
            }
        } else if (depth === 3 && currentL1Key && currentL2Key) {
            const l1 = getOrCreate(config[currentSection], currentL1Key);
            const l2 = getOrCreate(l1 as HkMap, currentL2Key);
            const keys = rawKey.includes('.') ? rawKey.split('.') : [rawKey];
            setNestedValue(l2 as HkMap, keys, parseValue(rawVal || '', i + 1));
        }
    }

    return config;
}

function parseValue(raw: string, line: number): HkValue {
    const s = raw.trim();

    // Boolean
    if (s.toLowerCase() === 'true') return true;
    if (s.toLowerCase() === 'false') return false;

    // Array [1, "two", true]
    if (s.startsWith('[') && s.endsWith(']')) {
        const inner = s.slice(1, -1).trim();
        if (!inner) return [];
        return splitArrayElements(inner).map(e => parseValue(e.trim(), line));
    }

    // Number
    const num = Number(s);
    if (!isNaN(num) && s !== '') return num;

    // Quoted string
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1)
            .replace(/\\n/g, '\n').replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    return s;
}

function splitArrayElements(inner: string): string[] {
    const result: string[] = [];
    let depth = 0, inStr = false, strChar = '', start = 0;
    for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (inStr) { if (c === strChar && inner[i - 1] !== '\\') inStr = false; continue; }
        if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
        if (c === '[') { depth++; continue; }
        if (c === ']') { depth--; continue; }
        if (c === ',' && depth === 0) {
            result.push(inner.slice(start, i).trim());
            start = i + 1;
        }
    }
    const last = inner.slice(start).trim();
    if (last) result.push(last);
    return result;
}

function setNestedValue(obj: HkMap, keys: string[], value: HkValue): void {
    let cur: HkMap = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (typeof cur[keys[i]] !== 'object' || Array.isArray(cur[keys[i]])) {
            cur[keys[i]] = {};
        }
        cur = cur[keys[i]] as HkMap;
    }
    cur[keys[keys.length - 1]] = value;
}

function getOrCreate(obj: HkMap, key: string): HkValue {
    if (!(key in obj)) obj[key] = {};
    return obj[key];
}

// ── Interpolation ─────────────────────────────────────────────────────────

export function resolveInterpolations(config: HkConfig, env?: Record<string, string>): HkConfig {
    const envVars = env || {};
    const resolved = JSON.parse(JSON.stringify(config)) as HkConfig;

    function resolveStr(s: string): string {
        return s.replace(/\$\{([^}]+)\}/g, (_, ref) => {
            if (ref.startsWith('env:')) {
                const varName = ref.slice(4);
                return envVars[varName] || '';
            }
            // section.key or section.key.subkey
            const parts = ref.split('.');
            const section = parts[0];
            let val: any = resolved[section];
            for (let i = 1; i < parts.length; i++) {
                if (val == null) return '';
                // Handle array indexing like list[0]
                const arrMatch = parts[i].match(/^(.+)\[(\d+)\]$/);
                if (arrMatch) {
                    val = val[arrMatch[1]];
                    if (Array.isArray(val)) val = val[parseInt(arrMatch[2])];
                } else {
                    val = val[parts[i]];
                }
            }
            return val != null ? String(val) : '';
        });
    }

    function resolveObj(obj: any): any {
        if (typeof obj === 'string') return resolveStr(obj);
        if (Array.isArray(obj)) return obj.map(resolveObj);
        if (typeof obj === 'object' && obj !== null) {
            const out: any = {};
            for (const k in obj) out[k] = resolveObj(obj[k]);
            return out;
        }
        return obj;
    }

    return resolveObj(resolved);
}

// ── Serializer ────────────────────────────────────────────────────────────

export function serializeHk(config: HkConfig): string {
    const lines: string[] = [];
    for (const [section, data] of Object.entries(config)) {
        lines.push(`[${section}]`);
        serializeMap(data, 1, lines);
        lines.push('');
    }
    return lines.join('\n');
}

function serializeMap(obj: HkMap, depth: number, lines: string[]): void {
    const arrow = '-'.repeat(depth) + '>';
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            lines.push(`${arrow} ${key}`);
            serializeMap(value as HkMap, depth + 1, lines);
        } else {
            lines.push(`${arrow} ${key} => ${serializeValue(value)}`);
        }
    }
}

function serializeValue(v: HkValue): string {
    if (typeof v === 'string') {
        if (v.includes('\n') || v.includes('"')) return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
        return v;
    }
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) return `[${v.map(serializeValue).join(', ')}]`;
    return JSON.stringify(v);
}

// ── Config file helpers for Blue Environment ──────────────────────────────

const HK_CONFIG_PATH = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        return null; // Use Tauri fs API
    }
    return null;
};

export async function loadHkConfig(filename: string): Promise<HkConfig> {
    try {
        if ((window as any).__TAURI__) {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const content = await invoke<string>('read_config_file', { filename });
            if (content) return resolveInterpolations(parseHk(content));
        }
    } catch {}
    return {};
}

export async function saveHkConfig(filename: string, config: HkConfig): Promise<void> {
    try {
        if ((window as any).__TAURI__) {
            const { invoke } = await import('@tauri-apps/api/tauri');
            await invoke('write_config_file', { filename, content: serializeHk(config) });
        }
    } catch {}
}

// Convenience: read a single value from a config file
export function hkGet(config: HkConfig, section: string, key: string): HkValue | null {
    const s = config[section];
    if (!s) return null;
    const parts = key.split('.');
    let val: any = s;
    for (const p of parts) {
        if (val == null || typeof val !== 'object') return null;
        val = val[p];
    }
    return val ?? null;
}
