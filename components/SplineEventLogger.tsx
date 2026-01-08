"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventLog {
  id: number;
  timestamp: string;
  type: 'click' | 'hover' | 'load' | 'error';
  target: string;
  action: string;
}

export default function SplineEventLogger() {
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen to console.log (intercept for display)
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);

      // Parse our custom logs
      const message = args.join(' ');
      if (message.includes('🖱️ Clicked:') || message.includes('✅') || message.includes('🚀')) {
        const newLog: EventLog = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: message.includes('Clicked') ? 'click' : message.includes('loaded') ? 'load' : 'hover',
          target: args[1] || 'Unknown',
          action: message,
        };

        setLogs(prev => [newLog, ...prev].slice(0, 10)); // Keep last 10 logs
      }
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-[100] px-4 py-2 rounded-lg text-xs font-semibold text-white"
        style={{
          background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
          boxShadow: "0 4px 20px rgba(139, 92, 246, 0.5)",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isVisible ? '❌ Hide' : '🔍 Event Logger'} ({logs.length})
      </motion.button>

      {/* Event Log Panel */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-20 right-4 z-[100] w-[400px] max-h-[500px] overflow-hidden rounded-xl"
            style={{
              background: "rgba(20, 20, 30, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6)",
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Spline Event Logger</h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Logs */}
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-8">
                  No events yet. Click on Spline elements!
                </div>
              ) : (
                logs.map(log => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg"
                    style={{
                      background: "rgba(139, 92, 246, 0.1)",
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${
                        log.type === 'click' ? 'text-cyan-400' :
                        log.type === 'load' ? 'text-green-400' :
                        log.type === 'hover' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {log.type === 'click' ? '🖱️ Click' :
                         log.type === 'load' ? '✅ Load' :
                         log.type === 'hover' ? '👆 Hover' :
                         '❌ Error'}
                      </span>
                      <span className="text-[10px] text-gray-500">{log.timestamp}</span>
                    </div>
                    <div className="text-xs text-white font-mono">{log.target}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{log.action}</div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/10 bg-black/20">
              <div className="text-[10px] text-gray-500">
                💡 Tip: Click any Spline button to see events here
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
