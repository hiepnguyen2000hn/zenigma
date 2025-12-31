"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Lock, ArrowRight, PlayCircle } from "lucide-react";
import Image from "next/image";
import DecryptedText from "../DecryptedText";
import { useRef } from "react";

export default function HeroLanding() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  // Parallax transforms
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.8, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 15]);

  return (
    <section ref={ref} className="relative min-h-[600px] w-full overflow-hidden pt-32 pb-10">
      <motion.div
        className="max-w-[1440px] mx-auto px-12 relative z-10"
        style={{ y, opacity }}
      >
        <div className="grid grid-cols-[55%_45%] gap-20 items-center">
          {/* LEFT - Text */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="inline-block px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-wider leading-[10px] text-[#217D87]"
              style={{
                background: "rgba(33, 125, 135, 0.15)",
                border: "1px solid rgba(33, 125, 135, 0.4)",
              }}
            >
              NEXT GENERATION CRYPTOGRAPHY
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="max-w-[600px] mt-4"
            >
              <h1 className="font-bold text-[30px] leading-[31px] text-[#CECFD1] mb-[2px]">
                <DecryptedText
                  text="Zero-Knowledge Proofs"
                  animateOn="both"
                  speed={60}
                  maxIterations={12}
                  sequential={true}
                  revealDirection="start"
                  className="text-[#CECFD1]"
                  encryptedClassName="text-[#357F8C]"
                />
              </h1>
              <h2 className="font-normal text-[28px] leading-[34px] text-[#A1A2A5] mt-2">
                for Trustless Privacy
              </h2>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-[14px] leading-[1.6] max-w-[450px] pt-4 text-[#94A3B8]"
            >
              Zero-knowledge method rigorously proves valid statements without revealing your certification. Enable private transactions, identity compliance, and trustless verification on Web3.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="flex items-center gap-3 pt-3"
            >
              <motion.button
                className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white border border-transparent"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                  boxShadow: "0 4px 24px rgba(139, 92, 246, 0.5)",
                }}
                whileHover={{
                  y: -2,
                  boxShadow: "0 8px 32px rgba(139, 92, 246, 0.7)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                Explore Docs <ArrowRight className="w-3.5 h-3.5 inline ml-1.5" />
              </motion.button>

              <motion.button
                className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white border-[1.5px] border-white/20 bg-transparent"
                whileHover={{
                  borderColor: "rgba(53, 127, 140, 0.6)",
                  background: "rgba(53, 127, 140, 0.1)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                <PlayCircle className="w-3.5 h-3.5 inline mr-1.5" />
                Watch Demo
              </motion.button>
            </motion.div>
          </div>

          {/* RIGHT - 3D Cube Layout */}
          <motion.div
            className="relative flex items-center justify-center"
            style={{
              scale,
              rotateX,
              transformPerspective: 1000
            }}
          >
            {/* 60ms Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute top-0 right-0 flex flex-col gap-1 px-3 py-2.5 rounded-lg z-10"
              style={{
                background: "rgba(40, 37, 55, 0.5)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(53, 127, 140, 0.3)",
              }}
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#357F8C]" />
                <span className="text-[13px] font-bold text-[#357F8C]">
                  60ms
                </span>
              </div>
              <span className="text-[9px] text-[#94A3B8] leading-tight">
                Average proof time
              </span>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
