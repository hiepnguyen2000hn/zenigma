"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

interface TimelineSection {
  label: string;
  progress: number; // 0-100
  color: string;
}

export default function ScrollTimelineIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [currentSection, setCurrentSection] = useState(0);

  const sections: TimelineSection[] = [
    { label: "Hero", progress: 0, color: "#8B5CF6" },
    { label: "Cube Zoom", progress: 25, color: "#3B82F6" },
    { label: "Particles", progress: 50, color: "#357F8C" },
    { label: "Features", progress: 75, color: "#10B981" },
  ];

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      const progress = latest * 100;

      if (progress < 25) setCurrentSection(0);
      else if (progress < 50) setCurrentSection(1);
      else if (progress < 75) setCurrentSection(2);
      else setCurrentSection(3);
    });
  }, [scrollYProgress]);

  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex items-center gap-4">
      {/* Timeline bar */}
      <div className="relative w-1 h-64 bg-white/10 rounded-full overflow-hidden">
        {/* Progress indicator */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#8B5CF6] via-[#3B82F6] to-[#357F8C] rounded-full"
          style={{ scaleY, transformOrigin: "bottom" }}
        />

        {/* Section markers */}
        {sections.map((section, i) => (
          <div
            key={i}
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-all duration-300"
            style={{
              top: `${section.progress}%`,
              background: currentSection >= i ? section.color : "rgba(255,255,255,0.2)",
              boxShadow: currentSection === i ? `0 0 20px ${section.color}` : "none",
              transform: `translateX(-50%) scale(${currentSection === i ? 1.5 : 1})`,
            }}
          />
        ))}
      </div>

      {/* Current section label */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
        style={{
          background: `${sections[currentSection]?.color}40`,
          border: `1px solid ${sections[currentSection]?.color}`,
          backdropFilter: "blur(12px)",
        }}
      >
        {sections[currentSection]?.label}
      </motion.div>
    </div>
  );
}
