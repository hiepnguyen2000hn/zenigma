"use client";

import { useEffect, useRef, RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollAnimationConfig {
  trigger: RefObject<HTMLElement> | string;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  pin?: boolean;
  markers?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onUpdate?: (progress: number) => void;
}

/**
 * Hook for creating GSAP scroll animations
 */
export const useScrollAnimation = (
  animationFn: (element: HTMLElement) => gsap.core.Timeline | gsap.core.Tween,
  config: ScrollAnimationConfig
) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = typeof config.trigger === 'string'
      ? document.querySelector(config.trigger)
      : config.trigger.current || ref.current;

    if (!element) return;

    const ctx = gsap.context(() => {
      const animation = animationFn(element as HTMLElement);

      ScrollTrigger.create({
        trigger: element,
        start: config.start || "top center",
        end: config.end || "bottom center",
        scrub: config.scrub ?? false,
        pin: config.pin ?? false,
        markers: config.markers ?? false,
        onEnter: config.onEnter,
        onLeave: config.onLeave,
        onUpdate: (self) => {
          if (config.onUpdate) {
            config.onUpdate(self.progress);
          }
        },
        animation: animation,
      });
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return ref;
};

/**
 * Hook for cube zoom scroll effect (100vh-200vh)
 */
export const useCubeZoomEffect = (cubeRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!cubeRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: cubeRef.current,
          start: "top top",
          end: "+=100vh",
          scrub: 1,
          pin: true,
          markers: false,
        }
      });

      tl.to(cubeRef.current, {
        scale: 3,
        rotateY: 360,
        rotateX: 15,
        duration: 1,
        ease: "power2.inOut"
      })
      .to(cubeRef.current, {
        opacity: 0,
        scale: 4,
        filter: "blur(20px)",
        duration: 0.3,
      }, ">");
    });

    return () => {
      ctx.revert();
    };
  }, [cubeRef]);
};

/**
 * Hook for staggered card reveal animations
 */
export const useStaggerReveal = (
  containerRef: RefObject<HTMLElement>,
  childSelector: string = ".card",
  staggerDelay: number = 0.15
) => {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const cards = containerRef.current?.querySelectorAll(childSelector);

      gsap.fromTo(
        cards,
        {
          opacity: 0,
          y: 80,
          scale: 0.95,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          stagger: staggerDelay,
          ease: "cubic-bezier(0.4, 0, 0.2, 1)",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 70%",
            end: "bottom 30%",
            toggleActions: "play none none reverse",
          }
        }
      );
    });

    return () => {
      ctx.revert();
    };
  }, [containerRef, childSelector, staggerDelay]);
};

/**
 * Hook for parallax background effect
 */
export const useParallaxBackground = (
  bgRef: RefObject<HTMLElement>,
  speed: number = 0.5
) => {
  useEffect(() => {
    if (!bgRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(bgRef.current, {
        yPercent: 50 * speed,
        ease: "none",
        scrollTrigger: {
          trigger: bgRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        }
      });
    });

    return () => {
      ctx.revert();
    };
  }, [bgRef, speed]);
};

/**
 * Hook for hero entrance animation sequence
 * ✅ FIX: Thêm ScrollTrigger để animation reverse khi scroll back
 */
export const useHeroEntrance = (heroRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!heroRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play reverse play reverse", // ✅ Reverse khi scroll back
          // scrub: 0.5, // Uncomment để animation follow scroll position
        }
      });

      // Background fade in
      tl.fromTo(
        ".hero-background",
        { opacity: 0, filter: "blur(30px)" },
        { opacity: 1, filter: "blur(0px)", duration: 1.2, ease: "cubic-bezier(0.4, 0, 0.2, 1)" }
      )
      // Heading slide up
      .fromTo(
        ".hero-heading",
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: "cubic-bezier(0.4, 0, 0.2, 1)" },
        "-=0.8"
      )
      // 3D cube scale in
      .fromTo(
        ".hero-cube",
        { opacity: 0, scale: 0.5, rotateY: -45 },
        { opacity: 1, scale: 1, rotateY: 0, duration: 1.2, ease: "back.out(1.4)" },
        "-=0.6"
      )
      // Subtext fade in
      .fromTo(
        ".hero-subtext",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "cubic-bezier(0.4, 0, 0.2, 1)" },
        "-=0.4"
      )
      // Buttons stagger
      .fromTo(
        ".hero-button",
        { opacity: 0, y: 20, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          stagger: 0.1,
          ease: "cubic-bezier(0.4, 0, 0.2, 1)"
        },
        "-=0.3"
      );
    }, heroRef);

    return () => {
      ctx.revert();
    };
  }, [heroRef]);
};