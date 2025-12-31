"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Shield, LineChart, Target } from "lucide-react";
import SpotlightCard from "../SpotlightCard";
import { useRef } from "react";

export default function ThreeCardSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Parallax effects - staggered for each card
  const y1 = useTransform(scrollYProgress, [0, 1], ["30%", "-10%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const y3 = useTransform(scrollYProgress, [0, 1], ["25%", "-15%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.8]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.95]);

  const cards = [
    {
      icon: Shield,
      title: "Why It Matters",
      subtitle: "On-Chain Privacy",
      description: "Zero-knowledge proofs enable private transactions and identity verification without exposing sensitive information. Maintain complete privacy while proving validity of your credentials and transactions on-chain.",
      color: "#8B5CF6",
    },
    {
      icon: LineChart,
      title: "Hovate Trading Platform",
      subtitle: "Scalability at Scale",
      description: "Execute trades with complete privacy and MEV-resistance. Our ZK-powered platform ensures lightning-fast proof generation while maintaining security and protecting trader information from front-running.",
      color: "#357F8C",
    },
    {
      icon: Target,
      title: "Finalize",
      subtitle: "Scalability at Scale",
      description: "Production-ready cryptographic protocols battle-tested for enterprise deployment. Built with industry-standard security practices and optimized for real-world applications at scale.",
      color: "#10B981",
    },
  ];

  const cardYs = [y1, y2, y3];

  return (
    <section ref={ref} className="relative w-full py-8">
      <motion.div
        className="max-w-[1280px] mx-auto px-12"
        style={{ opacity, scale }}
      >
        <div className="grid grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div key={i} style={{ y: cardYs[i] }}>
              <SpotlightCard
                spotlightColor={`${card.color}40`}
                className="rounded-2xl h-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="rounded-2xl p-5 relative overflow-hidden h-full flex flex-col"
                  style={{
                    background: "rgba(40, 37, 55, 0.4)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${card.color}33`,
                    boxShadow: `0 0 20px ${card.color}22`,
                  }}
                >
              {/* Icon + Title ở trên cùng */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${card.color}, ${card.color}88)`,
                    boxShadow: `0 4px 20px ${card.color}44`,
                  }}
                >
                  <card.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <h3 className="text-[15px] font-semibold text-white">{card.title}</h3>
              </div>

              {/* Divider */}
              <div
                className="w-full h-[1px] mb-3"
                style={{
                  background: `linear-gradient(90deg, ${card.color}40, transparent)`,
                }}
              />

              {/* Content bên dưới */}
              <h4 className="text-[11px] font-medium mb-2 text-[#94A3B8]">
                {card.subtitle}
              </h4>
              <p className="text-[11px] leading-[1.6] text-[#94A3B8]">
                {card.description}
              </p>
                </motion.div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
