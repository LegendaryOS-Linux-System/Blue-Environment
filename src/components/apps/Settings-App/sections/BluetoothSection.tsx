import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SystemBridge } from '../../../../utils/systemBridge';

interface BtDevice { name: string; mac: string; connected: boolean; device_type: string; battery?: number; }

const BluetoothSection: React.FC = () => {
    const [devices, setDevices] = useState<BtDevice[]>([]);
    const [scanning, setScanning] = useState(false);
    const [enabled, setEnabled] = useState(true);

    const scan = async () => {
        setScanning(true);
        const devs = await SystemBridge.getBluetoothDevices();
        setDevices(devs);
        setScanning(false);
    };
    const toggle = async (mac: string) => {
        await SystemBridge.toggleBluetoothDevice(mac);
        scan();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Bluetooth</h2>
                <button onClick={scan} className="p-2 bg-slate-800 rounded-full hover:bg-white/10">
                    <RefreshCw size={18} className={scanning ? 'animate-spin' : ''} />
                </button>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-between">
                <span className="text-white">Bluetooth</span>
                <button onClick={() => setEnabled(!enabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-slate-600'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
            </div>
            <div className="bg-slate-800 border border-white/5 rounded-2xl overflow-hidden">
                {devices.length === 0 && !scanning && (
                    <div className="p-8 text-center text-slate-500 cursor-pointer hover:text-white" onClick={scan}>
                        No devices found — click to scan
                    </div>
                )}
                {devices.map((dev, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5">
                        <div>
                            <div className="font-medium text-white">{dev.name}</div>
                            <div className="text-xs text-slate-400">
                                {dev.device_type} · {dev.connected ? 'Connected' : 'Disconnected'}
                                {dev.battery != null && ` · ${dev.battery}%`}
                            </div>
                        </div>
                        <button onClick={() => toggle(dev.mac)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${dev.connected ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                            {dev.connected ? 'Disconnect' : 'Connect'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default BluetoothSection;
