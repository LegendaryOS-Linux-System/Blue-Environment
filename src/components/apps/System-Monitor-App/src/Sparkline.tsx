import React, { useRef, useEffect } from 'react';
import { HistPoint, MAX_HISTORY } from './types';

interface Props { data: HistPoint[]; color: string; h?: number; }

const Sparkline: React.FC<Props> = ({ data, color, h = 48 }) => {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current; if (!c || data.length < 2) return;
        const ctx = c.getContext('2d')!;
        const W = c.offsetWidth || 280, H = h;
        c.width = W; c.height = H;
        ctx.clearRect(0, 0, W, H);
        const max = Math.max(...data.map(d => d.v), 1);
        const pts = data.map((d, i) => [i / (MAX_HISTORY - 1) * W, H - (d.v / max) * H * 0.85] as [number, number]);
        ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p));
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = color + '25'; ctx.fill();
    }, [data, color, h]);
    return <canvas ref={ref} className="w-full" style={{ height: h }} />;
};

export default Sparkline;
