"use client";

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

interface ParticleSystemProps {
  particleCount?: number;
  colors?: string[];
  trigger?: boolean;
  onComplete?: () => void;
}

export default function ParticleSystem({
  particleCount = 50,
  colors = ['#8B5CF6', '#3B82F6', '#357F8C'],
  trigger = false,
  onComplete
}: ParticleSystemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles (from cube center)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: centerX,
      y: centerY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      size: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
    }));

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Fade out
        particle.opacity -= 0.015;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = Math.max(0, particle.opacity);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Add glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = particle.color;
      });

      // Check if all particles faded
      const allFaded = particlesRef.current.every(p => p.opacity <= 0);
      if (allFaded) {
        if (onComplete) onComplete();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (trigger) {
      animate();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [trigger, particleCount, colors, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        opacity: trigger ? 1 : 0,
        transition: 'opacity 0.3s ease-out'
      }}
    />
  );
}