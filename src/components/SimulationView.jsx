import React, { useRef, useEffect } from 'react';

const SimulationView = ({ evolution, onFrame, showAll, speed = 1 }) => {
  const canvasRef   = useRef(null);
  const trailsRef   = useRef([]);
  const speedRef    = useRef(speed);
  const showAllRef  = useRef(showAll);

  // Keep refs in sync without remounting canvas
  useEffect(() => { speedRef.current = speed; },   [speed]);
  useEffect(() => { showAllRef.current = showAll; }, [showAll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let rafId;

    // Resize canvas to fill parent
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Starfield
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      o: Math.random() * 0.6 + 0.1,
    }));

    // speedRef / showAllRef are component-level refs (updated above)

    const render = () => {
      // Run multiple physics steps per frame for speed > 1
      const steps = speedRef.current;
      for (let s = 0; s < steps; s++) {
        evolution.physics.step();
        evolution.update();
      }
      if (onFrame) onFrame();

      const W = canvas.width, H = canvas.height;

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#020617');
      bg.addColorStop(1, '#0f172a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Stars
      const t = Date.now() * 0.0008;
      stars.forEach(s => {
        ctx.globalAlpha = s.o * (0.6 + Math.sin(t + s.x * 10) * 0.4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Best creature for camera
      const best = evolution.population.reduce((p, c) => c.fitness > p.fitness ? c : p);

      const scale  = 50;
      const camX   = best.torso.translation().x * scale;
      const offsetX = W / 3 - camX;
      const offsetY = H - 80;

      // Trail
      const tp = best.torso.translation();
      trailsRef.current.push({ x: tp.x * scale, y: tp.y * scale });
      if (trailsRef.current.length > 60) trailsRef.current.shift();

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(1, -1);

      // Trail path
      if (trailsRef.current.length > 2) {
        ctx.beginPath();
        ctx.moveTo(trailsRef.current[0].x, trailsRef.current[0].y);
        trailsRef.current.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = 'rgba(6,182,212,0.35)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Ground
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-20000, -25, 40000, 25);
      const gGlow = ctx.createLinearGradient(0, 0, 0, 60);
      gGlow.addColorStop(0, 'rgba(6,182,212,0.07)');
      gGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = gGlow;
      ctx.fillRect(-20000, 0, 40000, 60);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let i = -200; i < 2000; i++) {
        const gx = i * 100;
        ctx.beginPath(); ctx.moveTo(gx, -25); ctx.lineTo(gx, 500); ctx.stroke();
      }

      // Metre markers
      ctx.save();
      ctx.scale(1, -1);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '9px Inter, monospace';
      for (let i = -20; i < 500; i += 5) {
        ctx.fillText(`${i}m`, i * scale, 38);
      }
      ctx.restore();

      // Population — respect showAll flag
      const showAllNow = showAllRef.current;
      evolution.population.forEach(creature => {
        const isBest = creature === best;
        if (!showAllNow && !isBest) return; // hide others if solo mode

        ctx.globalAlpha = isBest ? 1 : 0.25;

        creature.parts.forEach(part => {
          const { x, y } = part.translation();
          const rot = part.rotation();
          ctx.save();
          ctx.translate(x * scale, y * scale);
          ctx.rotate(rot);

          // Glow aura for best
          if (isBest) {
            const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
            grd.addColorStop(0, 'rgba(6,182,212,0.2)');
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
          }

          let w = 5, h = 10;
          const m = creature.morphology;
          if (part === creature.torso) {
            w = Math.max(10, m.torsoHalfWidth * scale);
            h = 10;
          } else if (part === creature.tail) {
            w = 15; h = 3;
          } else if (part === creature.lArm || part === creature.rArm) {
            w = 3; h = 10;
          } else if (part === creature.lForearm || part === creature.rForearm) {
            w = 2.5; h = 10;
          } else if (part === creature.lThigh || part === creature.rThigh) {
            w = 5;
            h = Math.max(8, m.thighHalfHeight * scale);
          } else {
            w = 4;
            h = Math.max(8, m.shinHalfHeight * scale);
          }

          // Color: best = cyan, others = gradient by rank
          ctx.fillStyle   = isBest ? '#06b6d4' : '#334155';
          ctx.strokeStyle = isBest ? '#22d3ee' : '#475569';
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.roundRect(-w, -h, w * 2, h * 2, 3);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      });

      ctx.restore();
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(render);
    };

    render();
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [evolution, onFrame]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display:'block', width:'100%', height:'100%' }}
    />
  );
};

export default SimulationView;
