"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 h-20"
      style={{
        background: "rgba(10, 14, 39, 0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(36, 70, 99, 0.25)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-12 h-full flex items-center justify-between">
        {/* Logo */}
        <motion.div
          className="text-xl font-bold text-white tracking-tight"
          whileHover={{ filter: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))" }}
          transition={{ duration: 0.2 }}
        >
          ZK-Proof
        </motion.div>

        {/* Navigation */}
        <nav className="flex items-center gap-10">
          {["Concept", "Features", "Developers"].map((item) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium relative group"
              style={{ color: "#94A3B8" }}
              whileHover={{ color: "#FFFFFF" }}
              transition={{ duration: 0.2 }}
            >
              {item}
              <motion.div
                className="absolute -bottom-1 left-0 h-0.5"
                style={{ background: "#8B5CF6" }}
                initial={{ width: 0 }}
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.25 }}
              />
            </motion.a>
          ))}
        </nav>

        {/* CTA Button */}
        <Link href="/TradingDashboard/btc-usdc">
          <motion.button
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
              boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)",
            }}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 0 28px rgba(139, 92, 246, 0.6)",
            }}
            whileTap={{ scale: 0.98 }}
          >
            Launch App
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </Link>
      </div>
    </motion.header>
  );
}
