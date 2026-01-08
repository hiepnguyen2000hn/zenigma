"use client";

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface CounterAnimationConfig {
  start?: number;
  end: number;
  duration?: number;
  ease?: string;
  suffix?: string;
  decimals?: number;
  triggerOnView?: boolean;
}

/**
 * Hook for animated counter (e.g., 0 → 60ms)
 */
export const useCounterAnimation = (config: CounterAnimationConfig) => {
  const [count, setCount] = useState(config.start || 0);
  const elementRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!elementRef.current) return;

    const animateCounter = () => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;

      const obj = { value: config.start || 0 };

      gsap.to(obj, {
        value: config.end,
        duration: config.duration || 2,
        ease: config.ease || "power2.out",
        onUpdate: () => {
          const formattedValue = config.decimals !== undefined
            ? obj.value.toFixed(config.decimals)
            : Math.round(obj.value);
          setCount(Number(formattedValue));
        }
      });
    };

    if (config.triggerOnView) {
      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: elementRef.current,
          start: "top 80%",
          onEnter: animateCounter,
          once: true,
        });
      });

      return () => {
        ctx.revert();
      };
    } else {
      animateCounter();
    }
  }, [config]);

  const formattedCount = config.suffix ? `${count}${config.suffix}` : count;

  return { count: formattedCount, ref: elementRef };
};

/**
 * Hook for multiple counters animation (stats section)
 */
export const useMultipleCounters = (
  counters: Array<{ start: number; end: number; suffix?: string }>,
  triggerOnView = true
) => {
  const [counts, setCounts] = useState(counters.map(c => c.start));
  const containerRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const animateCounters = () => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;

      counters.forEach((counter, index) => {
        const obj = { value: counter.start };

        gsap.to(obj, {
          value: counter.end,
          duration: 2,
          delay: index * 0.2, // Stagger each counter
          ease: "power2.out",
          onUpdate: () => {
            setCounts(prev => {
              const newCounts = [...prev];
              newCounts[index] = Math.round(obj.value);
              return newCounts;
            });
          }
        });
      });
    };

    if (triggerOnView) {
      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: containerRef.current,
          start: "top 80%",
          onEnter: animateCounters,
          once: true,
        });
      });

      return () => {
        ctx.revert();
      };
    } else {
      animateCounters();
    }
  }, []);

  return {
    counts: counts.map((count, i) =>
      counters[i].suffix ? `${count}${counters[i].suffix}` : count
    ),
    ref: containerRef
  };
};