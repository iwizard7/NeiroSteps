import React, { useRef, useState } from 'react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const EvolutionChart = ({ history }) => {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const PAD = { top: 10, right: 16, bottom: 28, left: 40 };

  if (history.length < 2) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <p className="text-[10px] uppercase tracking-widest text-center px-8">
          {history.length === 0
            ? 'Ожидание конца первого поколения...'
            : 'Нужно минимум 2 поколения'}
        </p>
      </div>
    );
  }

  const allBest = history.map(h => Number(h.best ?? 0));
  const allAvg  = history.map(h => Number(h.avg ?? 0));
  const finiteVals = [...allBest, ...allAvg].filter(Number.isFinite);

  const rawMin = Math.min(...finiteVals);
  const rawMax = Math.max(...finiteVals);
  const spread = Math.max(0.001, rawMax - rawMin);
  const yPad = Math.max(0.25, spread * 0.18);
  const minVal = rawMin - yPad;
  const maxVal = rawMax + yPad;
  const yRange  = Math.max(0.001, maxVal - minVal);
  const bestVals = allBest;
  const avgVals = allAvg;

  const toX = (i, W) =>
    PAD.left + (i / (history.length - 1)) * (W - PAD.left - PAD.right);
  const toY = (v, H) => {
    const raw = PAD.top + (1 - (v - minVal) / yRange) * (H - PAD.top - PAD.bottom);
    return clamp(raw, PAD.top, H - PAD.bottom);
  };

  const makePath = (vals, W, H) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, W)},${toY(v, H)}`).join(' ');

  const makeAreaPath = (vals, W, H) => {
    const line = makePath(vals, W, H);
    const lastX = toX(vals.length - 1, W);
    const baseline = H - PAD.bottom;
    return `${line} L${lastX},${baseline} L${toX(0, W)},${baseline} Z`;
  };

  const W = 600, H = 160;

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = W / rect.width;
    const svgX = x * scaleX;
    const plotW = W - PAD.left - PAD.right;
    const idx = Math.round(((svgX - PAD.left) / plotW) * (history.length - 1));
    const clamped = Math.max(0, Math.min(history.length - 1, idx));
    setTooltip({ idx: clamped, x, y: e.clientY - rect.top });
  };

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (i / yTicks) * (maxVal - minVal)
  );

  return (
    <div className="w-full h-full relative" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <clipPath id="plotClip">
            <rect
              x={PAD.left}
              y={PAD.top}
              width={W - PAD.left - PAD.right}
              height={H - PAD.top - PAD.bottom}
            />
          </clipPath>
        </defs>

        <defs>
          <linearGradient id="bestGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={toY(v, H)} x2={W - PAD.right} y2={toY(v, H)}
              stroke="#ffffff08" strokeWidth="1"
            />
            <text
              x={PAD.left - 6} y={toY(v, H) + 4}
              fontSize="9" fill="#64748b" textAnchor="end"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {history.map((h, i) => {
          if (history.length > 20 && i % Math.ceil(history.length / 10) !== 0) return null;
          return (
            <text
              key={i}
              x={toX(i, W)} y={H - 6}
              fontSize="9" fill="#64748b" textAnchor="middle"
            >
              {h.gen}
            </text>
          );
        })}

        <g clipPath="url(#plotClip)">
          {/* Avg area + line */}
          <path d={makeAreaPath(avgVals, W, H)} fill="url(#avgGrad)" />
          <path
            d={makePath(avgVals, W, H)}
            fill="none" stroke="#8b5cf6" strokeWidth="1.5"
            strokeDasharray="5 4" opacity="0.8"
          />

          {/* Best area + line */}
          <path d={makeAreaPath(bestVals, W, H)} fill="url(#bestGrad)" />
          <path
            d={makePath(bestVals, W, H)}
            fill="none" stroke="#06b6d4" strokeWidth="2.5"
          />
        </g>

        {/* Tooltip vertical line + dots */}
        {tooltip !== null && (
          <>
            <line
              x1={toX(tooltip.idx, W)} y1={PAD.top}
              x2={toX(tooltip.idx, W)} y2={H - PAD.bottom}
              stroke="#ffffff20" strokeWidth="1"
            />
            <circle
              cx={toX(tooltip.idx, W)} cy={toY(bestVals[tooltip.idx], H)}
              r="4" fill="#06b6d4" stroke="#fff" strokeWidth="1.5"
            />
            <circle
              cx={toX(tooltip.idx, W)} cy={toY(avgVals[tooltip.idx], H)}
              r="3" fill="#8b5cf6" stroke="#fff" strokeWidth="1"
            />
          </>
        )}
      </svg>

      {/* HTML Tooltip */}
      {tooltip !== null && history[tooltip.idx] && (
        <div
          className="glass-panel absolute pointer-events-none px-3 py-2 text-[10px] z-20 whitespace-nowrap"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 40,
            transform: tooltip.x > 200 ? 'translateX(-110%)' : 'none'
          }}
        >
          <p className="font-bold mb-1" style={{ color: '#64748b' }}>Ген. {history[tooltip.idx].gen}</p>
          <p style={{ color: '#06b6d4' }}>🏆 Лучший: {history[tooltip.idx].best.toFixed(2)} м</p>
          <p style={{ color: '#8b5cf6' }}>⌀ Средний: {history[tooltip.idx].avg.toFixed(2)} м</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-0 right-0 flex gap-3 text-[9px] opacity-60 pb-1 pr-2">
        <span className="flex items-center gap-1">
          <span style={{ width: 12, height: 2, background: '#06b6d4', display: 'inline-block', borderRadius: 1 }} />
          Лучший
        </span>
        <span className="flex items-center gap-1">
          <span style={{ width: 12, height: 2, background: '#8b5cf6', display: 'inline-block', borderRadius: 1 }} />
          Средний
        </span>
      </div>
    </div>
  );
};

export default EvolutionChart;
