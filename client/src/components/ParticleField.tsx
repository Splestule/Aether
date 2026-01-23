import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
}

const PARTICLE_COUNT = 900;
const MAX_SPEED = 0.32;
const FRICTION = 0.962;
const CURSOR_RADIUS = 190;

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();

    const initParticles = () => {
      const particles: Particle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * MAX_SPEED,
          vy: (Math.random() - 0.5) * MAX_SPEED,
          size: Math.random() * 1.6 + 0.4,
          baseAlpha: Math.random() * 0.55 + 0.15,
        });
      }
      particlesRef.current = particles;
    };

    initParticles();

    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const animate = () => {
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        // Apply mouse interaction
        if (mouse.active) {
          const dx = particle.x - mouse.x;
          const dy = particle.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

          if (distance < CURSOR_RADIUS) {
            const force = (CURSOR_RADIUS - distance) / CURSOR_RADIUS;
            const repulseStrength = force * 1.8;
            particle.vx += (dx / distance) * repulseStrength;
            particle.vy += (dy / distance) * repulseStrength;
          }
        }

        particle.vx *= FRICTION;
        particle.vy *= FRICTION;

        particle.x += particle.vx;
        particle.y += particle.vy;

        // Subtle random drift
        particle.vx += (Math.random() - 0.5) * 0.02;
        particle.vy += (Math.random() - 0.5) * 0.02;

        // Wrap around edges
        if (particle.x < -20) particle.x = canvas.width + 20;
        if (particle.x > canvas.width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = canvas.height + 20;
        if (particle.y > canvas.height + 20) particle.y = -20;

        const flicker = Math.sin((particle.x + particle.y) * 0.02 + Date.now() * 0.001);
        const alpha = Math.max(0, Math.min(1, particle.baseAlpha + flicker * 0.12));

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      resize();
      initParticles();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
