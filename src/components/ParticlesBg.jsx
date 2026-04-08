import { useRef, useEffect, useCallback } from 'react';

const ParticlesBg = ({
  quantity = 100,
  color = '#fff',
  ease = 100,
  staticity = 50,
  size = 1.2,
  className = '',
  refresh = false,
}) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const canvasSize = useRef({ w: 0, h: 0 });
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const hexToRgb = useCallback((hex) => {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }, []);

  const createParticle = useCallback(() => {
    const w = canvasSize.current.w;
    const h = canvasSize.current.h;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      translateX: 0,
      translateY: 0,
      size: Math.random() * size + 0.5,
      alpha: Math.random() * 0.6 + 0.1,
      targetAlpha: Math.random() * 0.6 + 0.1,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      magnetism: 0.1 + Math.random() * 4,
    };
  }, [size]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    canvasSize.current.w = rect.width;
    canvasSize.current.h = rect.height;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    contextRef.current = canvas.getContext('2d');
    contextRef.current.scale(dpr, dpr);
  }, [dpr]);

  const initParticles = useCallback(() => {
    particlesRef.current = [];
    for (let i = 0; i < quantity; i++) {
      particlesRef.current.push(createParticle());
    }
  }, [quantity, createParticle]);

  const drawParticle = useCallback((particle) => {
    const ctx = contextRef.current;
    if (!ctx) return;
    const { r, g, b } = hexToRgb(color);
    ctx.beginPath();
    ctx.arc(
      particle.x + particle.translateX,
      particle.y + particle.translateY,
      particle.size,
      0,
      2 * Math.PI
    );
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.alpha})`;
    ctx.fill();
  }, [color, hexToRgb]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas();
    initParticles();

    let lastMouseMove = 0;
    const handleMouseMove = (e) => {
      const now = performance.now();
      if (now - lastMouseMove < 50) return;
      lastMouseMove = now;
      const rect = canvas.getBoundingClientRect();
      const { w, h } = canvasSize.current;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && x <= w && y >= 0 && y <= h) {
        mouseRef.current = { x, y };
      }
    };

    let animationId;

    const animate = () => {
      const ctx = contextRef.current;
      if (!ctx) return;
      const { w, h } = canvasSize.current;
      ctx.clearRect(0, 0, w, h);

      particlesRef.current.forEach((particle, idx) => {
        // Move
        particle.x += particle.dx;
        particle.y += particle.dy;

        // Mouse attraction (use squared distance to avoid sqrt)
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        if (mx > 0 && my > 0) {
          const dx = particle.x - mx;
          const dy = particle.y - my;
          const distSq = dx * dx + dy * dy;
          if (distSq < 22500) { // 150px radius
            const dist = Math.sqrt(distSq);
            const force = -particle.magnetism / (dist / staticity);
            particle.translateX += force * (dx / dist);
            particle.translateY += force * (dy / dist);
          }
        }

        // Ease translate back
        particle.translateX *= 1 - 1 / ease;
        particle.translateY *= 1 - 1 / ease;

        // Fade
        particle.alpha += (particle.targetAlpha - particle.alpha) * 0.02;
        if (Math.abs(particle.targetAlpha - particle.alpha) < 0.01) {
          particle.targetAlpha = Math.random() * 0.6 + 0.1;
        }

        // Wrap around
        const px = particle.x + particle.translateX;
        const py = particle.y + particle.translateY;
        if (px < -10 || px > w + 10 || py < -10 || py > h + 10) {
          particlesRef.current[idx] = createParticle();
          // Spawn from edges
          const edge = Math.floor(Math.random() * 4);
          if (edge === 0) particlesRef.current[idx].x = -5;
          else if (edge === 1) particlesRef.current[idx].x = w + 5;
          else if (edge === 2) particlesRef.current[idx].y = -5;
          else particlesRef.current[idx].y = h + 5;
        }

        drawParticle(particle);
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      resizeCanvas();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [ease, staticity, color, quantity, createParticle, drawParticle, initParticles, resizeCanvas, refresh]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  );
};

export default ParticlesBg;
