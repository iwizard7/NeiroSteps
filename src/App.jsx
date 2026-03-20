import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initPhysics, PhysicsEngine } from './engine/Physics';
import { EvolutionManager } from './engine/Evolution';
import SimulationView from './components/SimulationView';
import Dashboard from './components/Dashboard';

const GEN_SEC = 30;
const DEFAULT_POPULATION = 12;

function App() {
  const [evolution, setEvolution]   = useState(null);
  const [generation, setGeneration] = useState(1);
  const [isPaused, setIsPaused]     = useState(false);
  const [stats, setStats]           = useState({ best: 0, avg: 0 });
  const [allTimeBest, setAllTimeBest] = useState(0);
  const [history, setHistory]       = useState([]);
  const [isReady, setIsReady]       = useState(false);
  const [timeLeft, setTimeLeft]     = useState(GEN_SEC);
  const [initError, setInitError]   = useState(null);
  const [showAll, setShowAll]       = useState(true);
  const [speed, setSpeed]           = useState(1);
  const [populationMode, setPopulationMode] = useState(DEFAULT_POPULATION);
  const [viewportH, setViewportH]   = useState(window.innerHeight);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const evoRef = useRef(null); // stable ref for callbacks
  const rapierRef = useRef(null);
  const isCompactLayout = viewportH < 820;
  const dashboardHeight = Math.round(
    Math.min(280, Math.max(isCompactLayout ? 220 : 230, viewportH * 0.32)),
  );

  const createSimulation = useCallback((populationSize) => {
    if (!rapierRef.current) return null;
    const physics = new PhysicsEngine(rapierRef.current);
    physics.createGround();
    const evo = new EvolutionManager(populationSize, physics);
    evoRef.current = evo;
    setEvolution(evo);
    setGeneration(1);
    setStats({ best: 0, avg: 0 });
    setAllTimeBest(0);
    setHistory([]);
    setTimeLeft(GEN_SEC);
    setShowAll(populationSize > 1);
    return evo;
  }, []);

  /* ── Init ── */
  useEffect(() => {
    (async () => {
      try {
        const RAPIER  = await initPhysics();
        rapierRef.current = RAPIER;
        createSimulation(DEFAULT_POPULATION);
        setIsReady(true);
      } catch (err) {
        console.error('Init error:', err);
        setInitError(err.message);
      }
    })();
  }, [createSimulation]);

  useEffect(() => {
    const handleResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const doNextGen = useCallback(() => {
    const evo = evoRef.current;
    if (!evo) return;
    const data = evo.nextGeneration();
    setGeneration(evo.generation);
    setStats({ best: data.best, avg: data.avg });
    setAllTimeBest(prev => Math.max(prev, data.best));
    setHistory(prev => [...prev, data]);
    setTimeLeft(GEN_SEC);
  }, []);

  /* ── Timer ── */
  useEffect(() => {
    if (isPaused || !isReady) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        const next = +(t - 0.1).toFixed(1);
        if (next <= 0) { doNextGen(); return GEN_SEC; }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [isPaused, isReady, doNextGen]);

  const updateStats = useCallback(() => {
    const evo = evoRef.current;
    if (!evo) return;
    setStats(prev => ({ ...prev, best: Math.max(prev.best, evo.bestFitness) }));
  }, []);

  /* ── Save ── */
  const handleSave = () => {
    const evo = evoRef.current;
    if (!evo) return;
    const data = JSON.stringify({ ...evo.toJSON(), appHistory: history });
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `neurosteps_gen${evo.generation}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Load ── */
  const handleLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const nextPop = data.populationSize === 1 ? 1 : DEFAULT_POPULATION;
        setPopulationMode(nextPop);
        const evo = createSimulation(nextPop);
        if (!evo) return;
        evo.loadJSON(data);
        setGeneration(evo.generation);
        const loadedHistory = data.appHistory ?? data.history ?? [];
        const loadedBest = loadedHistory.reduce((max, item) => Math.max(max, item.best ?? 0), 0);
        setHistory(loadedHistory);
        setAllTimeBest(loadedBest);
        setStats({ best: 0, avg: 0 });
        setTimeLeft(GEN_SEC);
        alert(`✅ Загружено поколение ${evo.generation}`);
      } catch (err) {
        alert('Ошибка загрузки: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePopulationModeChange = useCallback((size) => {
    if (size !== 1 && size !== DEFAULT_POPULATION) return;
    if (!rapierRef.current || size === populationMode) return;
    setPopulationMode(size);
    createSimulation(size);
  }, [createSimulation, populationMode]);

  /* ── Loading/Error screen ── */
  if (!isReady) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0c' }}>
        <div style={{ textAlign:'center', padding:'0 24px' }}>
          {initError ? (
            <div className="glass-panel" style={{ padding:24, maxWidth:400 }}>
              <p style={{ color:'#f87171', fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                Initialization Error
              </p>
              <p style={{ color:'#fca5a5', fontSize:12, fontFamily:'monospace', wordBreak:'break-all' }}>{initError}</p>
              <button className="btn btn-secondary" style={{ width:'100%', marginTop:16 }}
                onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : (
            <>
              <div style={{
                width:48, height:48, borderRadius:'50%', margin:'0 auto 16px',
                border:'2px solid transparent', borderTopColor:'#06b6d4', borderBottomColor:'#06b6d4',
                animation:'spin 1s linear infinite'
              }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{ color:'#06b6d4', fontFamily:'monospace', fontSize:13, letterSpacing:'0.15em' }}>
                INITIALIZING PHYSICS ENGINE...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

      {/* ── Header ── */}
      <header style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'8px 16px', flexShrink:0,
        background:'rgba(0,0,0,.55)', borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div>
          <h1 style={{
            fontSize:16, fontWeight:900, margin:0, lineHeight:1,
            background:'linear-gradient(135deg,#06b6d4,#3b82f6)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>NEUROSTEPS</h1>
          <p style={{ fontSize:8, color:'#475569', letterSpacing:'0.12em', margin:0 }}>
            EVOLUTIONARY LOCOMOTION LAB
          </p>
        </div>

        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          <Stat label="Поколение"  value={generation} color="#06b6d4" />
          <div style={{ width:1, height:28, background:'rgba(255,255,255,.08)' }} />
          <Stat label="Лучший"    value={`${stats.best.toFixed(1)}м`} color="#a78bfa" />
          <div style={{ width:1, height:28, background:'rgba(255,255,255,.08)' }} />
          {/* Timer bar */}
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:9, color:'#475569', margin:0, letterSpacing:'0.08em' }}>Следующий ген.</p>
            <div style={{ width:80, height:4, background:'rgba(255,255,255,.06)', borderRadius:2, marginTop:3 }}>
              <div style={{
                height:'100%', borderRadius:2, background:'#06b6d4',
                width:`${(timeLeft / GEN_SEC) * 100}%`, transition:'width .1s linear',
              }} />
            </div>
          </div>
        </div>
      </header>

      {/* ── Canvas ── */}
      <div style={{ flex:1, minHeight:0, position:'relative' }}>
        {!isPaused ? (
          <SimulationView evolution={evolution} onFrame={updateStats} showAll={showAll} speed={speed} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.3)' }}>
            <p style={{ fontSize:32, fontWeight:900, color:'#1e293b', letterSpacing:'-2px' }}>PAUSED</p>
          </div>
        )}
      </div>

      {/* ── Dashboard ── */}
      <div style={{ height: dashboardHeight, flexShrink:0 }}>
        <Dashboard
          evolution={evolution} stats={stats} history={history} allTimeBest={allTimeBest}
          generation={generation} isPaused={isPaused} showAll={showAll} speed={speed}
          populationMode={populationMode}
          compact={isCompactLayout}
          onTogglePause={() => setIsPaused(p => !p)}
          onNextGen={doNextGen}
          onSetShowAll={setShowAll}
          onSetPopulationMode={handlePopulationModeChange}
          onSetSpeed={setSpeed}
          onOpenStats={() => setIsStatsOpen(true)}
          onSave={handleSave}
          onLoad={handleLoad}
        />
      </div>

      {isStatsOpen && (
        <StatsModal
          generation={generation}
          stats={stats}
          history={history}
          populationMode={populationMode}
          onClose={() => setIsStatsOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign:'right' }}>
      <p style={{ fontSize:9, color:'#475569', margin:0, letterSpacing:'0.08em' }}>{label}</p>
      <p style={{ fontSize:15, fontWeight:700, margin:0, color, lineHeight:1.1 }}>{value}</p>
    </div>
  );
}

function StatsModal({ generation, stats, history, populationMode, onClose }) {
  const rows = [...history].sort((a, b) => b.gen - a.gen);
  const learning = getLearningSignal(history);

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:999,
        background:'rgba(2,6,23,.7)',
        backdropFilter:'blur(4px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:16,
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width:'min(760px, 100%)',
          maxHeight:'min(80vh, 620px)',
          display:'flex',
          flexDirection:'column',
          overflow:'hidden',
          borderRadius:12,
          border:'1px solid rgba(255,255,255,.1)',
        }}
      >
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'12px 14px',
          borderBottom:'1px solid rgba(255,255,255,.08)',
        }}>
          <div>
            <p style={{ fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>Статистика обучения</p>
            <p style={{ fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>Популяция: {populationMode} • Поколение: {generation}</p>
          </div>
          <button onClick={onClose} style={{
            border:'1px solid rgba(255,255,255,.1)',
            borderRadius:8, background:'rgba(255,255,255,.04)', color:'#cbd5e1',
            padding:'6px 10px', fontSize:12, cursor:'pointer',
          }}>
            Закрыть
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <MetricCard label="Текущий лучший" value={`${stats.best.toFixed(2)} м`} color="#06b6d4" />
          <MetricCard label="Текущий средний" value={`${stats.avg.toFixed(2)} м`} color="#8b5cf6" />
          <MetricCard label="Завершено" value={`${history.length} ген.`} color="#94a3b8" />
          <MetricCard label="Статус обучения" value={learning.label} color={learning.color} />
        </div>

        <div style={{ overflow:'auto', padding:'8px 14px 14px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ color:'#64748b', textAlign:'left' }}>
                <th style={{ padding:'8px 6px' }}>Поколение</th>
                <th style={{ padding:'8px 6px' }}>Лучший путь</th>
                <th style={{ padding:'8px 6px' }}>Средний путь</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding:'14px 6px', color:'#94a3b8' }}>
                    Пока нет завершённых поколений.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.gen} style={{ borderTop:'1px solid rgba(255,255,255,.06)' }}>
                    <td style={{ padding:'8px 6px', color:'#cbd5e1' }}>{row.gen}</td>
                    <td style={{ padding:'8px 6px', color:'#22d3ee' }}>{row.best.toFixed(2)} м</td>
                    <td style={{ padding:'8px 6px', color:'#a78bfa' }}>{row.avg.toFixed(2)} м</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{
      border:'1px solid rgba(255,255,255,.08)',
      borderRadius:8,
      padding:'8px 10px',
      background:'rgba(255,255,255,.03)',
    }}>
      <p style={{ fontSize:10, color:'#64748b', margin:0, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</p>
      <p style={{ fontSize:18, fontWeight:700, margin:'2px 0 0', color }}>{value}</p>
    </div>
  );
}

function getLearningSignal(history) {
  if (!history || history.length < 6) {
    return { label: 'Недостаточно данных', color: '#94a3b8' };
  }

  const WINDOW = Math.min(12, history.length);
  const tail = history.slice(-WINDOW);
  const first = tail[0];
  const last = tail[tail.length - 1];

  const bestDelta = last.best - first.best;
  const avgDelta = last.avg - first.avg;

  let improvements = 0;
  for (let i = 1; i < tail.length; i++) {
    if (tail[i].best > tail[i - 1].best) improvements++;
  }
  const improvementRate = improvements / (tail.length - 1);

  if (bestDelta > 0.45 && avgDelta > 0.2 && improvementRate >= 0.35) {
    return { label: 'Обучение идет', color: '#10b981' };
  }
  if (bestDelta > 0.15 || avgDelta > 0.08 || improvementRate >= 0.2) {
    return { label: 'Нестабильно, но растет', color: '#f59e0b' };
  }
  return { label: 'Плато', color: '#ef4444' };
}

export default App;
