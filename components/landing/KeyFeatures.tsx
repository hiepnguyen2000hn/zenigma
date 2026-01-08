"use client";

import { motion } from "framer-motion";
import { Cpu, Zap, CheckCircle, Shield, Lock, Layers, TrendingUp } from "lucide-react";
import { useRef } from "react";
import { useStaggerReveal } from "@/hooks/useScrollAnimation";

export default function KeyFeatures() {
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ GSAP animation với reverse khi scroll back
  useStaggerReveal(containerRef, ".feature-card", 0.08);

  const features = [
    {
      icon: Cpu,
      title: "Cryptographically Sound",
      description: "Mathematically provable security with industry-standard cryptographic protocols.",
      color: "#357F8C",
    },
    {
      icon: Zap,
      title: "Ultra-Fast Verification",
      description: "Lightning-fast proof generation and verification in milliseconds.",
      color: "#8B5CF6",
    },
    {
      icon: CheckCircle,
      title: "Complete Verification",
      description: "End-to-end verification system ensuring data integrity at every step.",
      color: "#8B5CF6",
    },
    {
      icon: Shield,
      title: "Admin Portal",
      description: "Comprehensive dashboard for managing and monitoring all ZK operations.",
      color: "#8B5CF6",
    },
    {
      icon: Lock,
      title: "Complete Privacy",
      description: "Zero-knowledge architecture that never exposes sensitive information.",
      color: "#8B5CF6",
    },
    {
      icon: Layers,
      title: "Highly Scalable",
      description: "Built to handle millions of proofs with minimal latency.",
      color: "#357F8C",
    },
    {
      icon: TrendingUp,
      title: "High Performance",
      description: "Optimized infrastructure for enterprise-grade performance and throughput.",
      color: "#357F8C",
    },
    {
      icon: Shield,
      title: "Production Ready",
      description: "Battle-tested cryptographic protocols ready for production deployment.",
      color: "#10B981",
    },
  ];

  return (
    <section className="relative w-full py-6">
      <div className="max-w-[1280px] mx-auto px-12">
        {/* Title animation - reverse khi scroll back */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-bold text-white text-center mb-16"
        >
          Key Features
        </motion.h2>

        <div ref={containerRef} className="grid grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="feature-card rounded-2xl p-6 relative overflow-hidden"
              whileHover={{
                y: -4,
                boxShadow: `0 8px 32px ${feature.color}55`,
              }}
              transition={{ duration: 0.2 }}
              style={{
                background: "rgba(40, 37, 55, 0.4)",
                backdropFilter: "blur(12px)",
                border: `1.5px solid ${feature.color}44`,
                boxShadow: `0 0 20px ${feature.color}22`,
                minHeight: "200px",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${feature.color}22` }}
              >
                <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
