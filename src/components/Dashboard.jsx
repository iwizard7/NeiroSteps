import React from 'react';
import { Play, Pause, Zap, Save, FolderOpen } from 'lucide-react';
import EvolutionChart from './EvolutionChart';

const Btn = ({ onClick, active, compact, disabled = false, children, title, style={} }) => (
  <button onClick={onClick} title={title} disabled={disabled} style={{
    border:'1px solid rgba(255,255,255,.08)', borderRadius:7, cursor:'pointer',
    padding: compact ? '4px 6px' : '5px 8px',
    fontSize: compact ? 10 : 11,
    fontWeight:600,
    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
    background: active ? 'rgba(6,182,212,.18)' : 'rgba(255,255,255,.04)',
    color:       active ? '#06b6d4' : '#94a3b8',
    transition:'all .15s',
    opacity: disabled ? 0.45 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    minWidth: 0,
    whiteSpace: 'nowrap',
    ...style,
  }}>{children}</button>
);

export default function Dashboard({
  evolution, stats, history, generation, isPaused, showAll, speed, populationMode,
  compact = false,
  onTogglePause, onNextGen, onSetShowAll, onSetPopulationMode, onSetSpeed, onSave, onLoad,
}) {
  const fileRef = React.useRef();
  const S = {
    root: {
      display:'grid',
      gridTemplateColumns:'minmax(170px, 190px) minmax(0, 1fr)',
      gap: compact ? 8 : 10,
      padding: compact ? '6px 10px' : '8px 14px',
      height:'100%',
      boxSizing:'border-box',
      background:'rgba(0,0,0,.45)',
      borderTop:'1px solid rgba(255,255,255,.06)',
    },
    panel: {
      background:'rgba(20,20,28,.7)',
      backdropFilter:'blur(12px)',
      border:'1px solid rgba(255,255,255,.08)',
      borderRadius:10,
      padding: compact ? '7px 9px' : '10px 12px',
      display:'flex',
      flexDirection:'column',
      gap: compact ? 5 : 8,
      minHeight: 0,
      overflow: 'hidden',
    },
    label: {
      fontSize: compact ? 8 : 9,
      color:'#475569',
      textTransform:'uppercase',
      letterSpacing:'0.08em',
      margin:0,
    },
    val: {
      fontSize: compact ? 17 : 20,
      fontWeight:700,
      margin:0,
      lineHeight:1,
    },
  };

  return (
    <div style={S.root}>

      {/* Left panel */}
      <div style={S.panel}>
        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <div>
            <p style={S.label}>Поколение</p>
            <p style={{ ...S.val, color:'#06b6d4' }}>{generation}</p>
          </div>
          <div>
            <p style={S.label}>Рекорд</p>
            <p style={{ ...S.val, fontSize: compact ? 14 : 17, color:'#a78bfa' }}>{(stats.best||0).toFixed(1)}м</p>
          </div>
        </div>

        {/* Mini-stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, paddingTop: compact ? 4 : 5, borderTop:'1px solid rgba(255,255,255,.05)' }}>
          {[['Поп.', evolution.populationSize], ['Мут.','12%'], ['Элита','25%'], ['Ист.', `${history.length}г`]].map(([l,v]) => (
            <div key={l} style={{ textAlign:'center' }}>
              <p style={{ ...S.label, fontSize:8 }}>{l}</p>
              <p style={{ fontSize: compact ? 10 : 11, fontWeight:600, margin:0, color:'#cbd5e1' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Controls row 1 */}
        <div style={{ display:'flex', gap:5 }}>
          <Btn onClick={onTogglePause} active={!isPaused} compact={compact} style={{ flex:1 }}>
            {isPaused ? <Play size={compact ? 11 : 12}/> : <Pause size={compact ? 11 : 12}/>}
            {isPaused ? 'Пуск' : 'Пауза'}
          </Btn>
          <Btn onClick={onNextGen} compact={compact} title="Следующее поколение">
            <Zap size={compact ? 11 : 12} style={{ color:'#facc15' }}/>
          </Btn>
        </div>

        {/* Training mode row */}
        <div style={{ display:'grid', gridTemplateColumns:`${compact ? 54 : 62}px minmax(0,1fr)`, alignItems:'center', gap:6 }}>
          <p style={S.label}>Обучение</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, minWidth:0 }}>
            <Btn onClick={() => onSetPopulationMode(1)} active={populationMode === 1} compact={compact} style={{ flex:1 }}>
              1 робот
            </Btn>
            <Btn onClick={() => onSetPopulationMode(12)} active={populationMode === 12} compact={compact} style={{ flex:1 }}>
              12 роб.
            </Btn>
          </div>
        </div>

        {/* Render mode row */}
        <div style={{ display:'grid', gridTemplateColumns:`${compact ? 54 : 62}px minmax(0,1fr)`, alignItems:'center', gap:6 }}>
          <p style={S.label}>Экран</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, minWidth:0 }}>
            <Btn onClick={() => onSetShowAll(false)} active={!showAll} compact={compact} style={{ flex:1 }}>
              Лидер
            </Btn>
            <Btn
              onClick={() => onSetShowAll(true)}
              active={showAll}
              compact={compact}
              disabled={populationMode === 1}
              title={populationMode === 1 ? 'В режиме 1 робота недоступно' : 'Показать всех'}
              style={{ flex:1 }}
            >
              Все
            </Btn>
          </div>
        </div>

        {/* Speed row */}
        <div style={{ display:'flex', gap:4 }}>
          {[1,2,4].map(s => (
            <Btn key={s} onClick={() => onSetSpeed(s)} active={speed===s} compact={compact} style={{ flex:1 }}>
              {s}×
            </Btn>
          ))}
        </div>

      </div>

      {/* Chart panel */}
      <div style={{ ...S.panel, overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <p style={S.label}>Прогресс обучения</p>
            {history.length > 0 && <span style={{ fontSize:9, color:'#334155' }}>{history.length} ген.</span>}
          </div>
          <div style={{ display:'flex', gap:5 }}>
            <Btn onClick={onSave} compact={compact} style={{ fontSize: compact ? 9 : 10 }}>
              <Save size={compact ? 10 : 11}/> Сохранить
            </Btn>
            <Btn onClick={() => fileRef.current?.click()} compact={compact} style={{ fontSize: compact ? 9 : 10 }}>
              <FolderOpen size={compact ? 10 : 11}/> Загрузить
            </Btn>
          </div>
        </div>
        <div style={{ flex:1, minHeight:0, overflow:'hidden' }}>
          <EvolutionChart history={history} />
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={onLoad} />
      </div>

    </div>
  );
}
