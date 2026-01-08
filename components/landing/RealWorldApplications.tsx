"use client";

import { motion } from "framer-motion";
import { FileText, Code, Workflow, Shield, ArrowRight } from "lucide-react";
import { useRef } from "react";
import { useStaggerReveal } from "@/hooks/useScrollAnimation";

export default function RealWorldApplications() {
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ GSAP animation với reverse khi scroll back
  useStaggerReveal(containerRef, ".app-card", 0.15);

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
          Real-World Applications
        </motion.h2>

        <div ref={containerRef} className="grid grid-cols-12 gap-5 mb-5">
          {/* Left column - smaller height */}
          <div className="col-span-5 grid gap-5">
            {/* Privacy-Preserving KYC - Takes full width */}
            <motion.div
              className="app-card rounded-2xl p-8 relative overflow-hidden"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "rgba(40, 37, 55, 0.5)",
                backdropFilter: "blur(16px)",
                border: "1.5px solid rgba(139, 92, 246, 0.4)",
                boxShadow: "0 0 30px rgba(139, 92, 246, 0.2)",
                minHeight: "280px",
              }}
            >
              {/* Chart visualization */}
              <div className="absolute top-8 right-8 opacity-40">
                <svg width="120" height="80" viewBox="0 0 120 80">
                  <path
                    d="M0,60 Q30,20 60,40 T120,30"
                    stroke="#357F8C"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                  />
                  <path
                    d="M0,65 L20,50 L40,55 L60,35 L80,45 L100,30 L120,25"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>

              <div className="relative z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "rgba(53, 127, 140, 0.2)",
                  }}
                >
                  <Shield className="w-6 h-6" style={{ color: "#357F8C" }} />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Privacy-Preserving KYC</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#94A3B8" }}>
                  Verify identity credentials without revealing personal information. Enable compliant privacy.
                </p>
                <motion.button
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #357F8C, #06B6D4)",
                    boxShadow: "0 0 20px rgba(53, 127, 140, 0.3)",
                  }}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: "0 0 28px rgba(53, 127, 140, 0.5)",
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Learn More <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Right column - taller card */}
          <div className="col-span-7">
            <motion.div
              className="app-card rounded-2xl p-8 relative overflow-hidden h-full"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "rgba(40, 37, 55, 0.5)",
                backdropFilter: "blur(16px)",
                border: "1.5px solid rgba(139, 92, 246, 0.4)",
                boxShadow: "0 0 30px rgba(139, 92, 246, 0.2)",
                minHeight: "280px",
              }}
            >
              {/* Decentralized network visualization */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <svg width="300" height="250" viewBox="0 0 300 250">
                  <circle cx="150" cy="125" r="40" fill="rgba(139, 92, 246, 0.3)" />
                  <circle cx="80" cy="60" r="25" fill="rgba(53, 127, 140, 0.3)" />
                  <circle cx="220" cy="60" r="25" fill="rgba(53, 127, 140, 0.3)" />
                  <circle cx="80" cy="190" r="25" fill="rgba(53, 127, 140, 0.3)" />
                  <circle cx="220" cy="190" r="25" fill="rgba(53, 127, 140, 0.3)" />
                  <line x1="150" y1="125" x2="80" y2="60" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="1" />
                  <line x1="150" y1="125" x2="220" y2="60" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="1" />
                  <line x1="150" y1="125" x2="80" y2="190" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="1" />
                  <line x1="150" y1="125" x2="220" y2="190" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="1" />
                </svg>
              </div>

              <div className="relative z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <Workflow className="w-6 h-6" style={{ color: "#8B5CF6" }} />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Decentralized Protocol</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#94A3B8" }}>
                  Build trustless decentralized applications with cryptographic guarantees. No central authority required.
                </p>
                <motion.button
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                    boxShadow: "0 0 20px rgba(139, 92, 246, 0.3)",
                  }}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: "0 0 28px rgba(139, 92, 246, 0.5)",
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Explore <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-5">
          {/* Developer Docs */}
          <motion.div
            className="app-card rounded-2xl p-8 relative overflow-hidden"
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "rgba(40, 37, 55, 0.5)",
              backdropFilter: "blur(16px)",
              border: "1.5px solid rgba(139, 92, 246, 0.4)",
              boxShadow: "0 0 30px rgba(139, 92, 246, 0.2)",
              minHeight: "220px",
            }}
          >
            <div className="relative z-10">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(139, 92, 246, 0.2)",
                }}
              >
                <FileText className="w-6 h-6" style={{ color: "#8B5CF6" }} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Developer Docs</h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#94A3B8" }}>
                Comprehensive documentation and SDKs to integrate ZK-proofs into your application.
              </p>
              <motion.button
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                  boxShadow: "0 0 20px rgba(139, 92, 246, 0.3)",
                }}
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 0 28px rgba(139, 92, 246, 0.5)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                Read Docs <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>

          {/* Interledger Demo */}
          <motion.div
            className="app-card rounded-2xl p-8 relative overflow-hidden"
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "rgba(40, 37, 55, 0.5)",
              backdropFilter: "blur(16px)",
              border: "1.5px solid rgba(53, 127, 140, 0.4)",
              boxShadow: "0 0 30px rgba(53, 127, 140, 0.2)",
              minHeight: "220px",
            }}
          >
            <div className="relative z-10">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(53, 127, 140, 0.2)",
                }}
              >
                <Code className="w-6 h-6" style={{ color: "#357F8C" }} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Interledger Demo</h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#94A3B8" }}>
                Experience cross-chain privacy with our interactive interledger protocol demo.
              </p>
              <motion.button
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #357F8C, #06B6D4)",
                  boxShadow: "0 0 20px rgba(53, 127, 140, 0.3)",
                }}
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 0 28px rgba(53, 127, 140, 0.5)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                Try Demo <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
