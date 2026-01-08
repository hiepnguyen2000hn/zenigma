"use client";

import {motion, useScroll, useTransform} from "framer-motion";
import {ArrowRight, Lock, PlayCircle} from "lucide-react";
import DecryptedText from "../DecryptedText";
import {useRef} from "react";
import {useHeroEntrance} from "@/hooks/useScrollAnimation";
import {useCounterAnimation} from "@/hooks/useCounterAnimation";
// import ParticleSystem from "../ParticleSystem";
import SplineScene from '../SplineScene';
import Spline from '@splinetool/react-spline';

export default function HeroLanding() {
    const ref = useRef(null);
    const heroRef = useRef<HTMLElement>(null);
    const cubeRef = useRef<HTMLDivElement>(null);
    // const [showParticles, setShowParticles] = useState(false);

    const {scrollYProgress} = useScroll({
        target: ref, offset: ["start start", "end start"]
    });

    // Parallax transforms for scroll-based effects
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.8, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
    const rotateX = useTransform(scrollYProgress, [0, 1], [0, 15]);

    // GSAP animations
    // useHeroEntrance(heroRef); // ❌ Commented: Content đã bị comment
    // useCubeZoomEffect(cubeRef); // ❌ Commented: Không cần zoom effect với Spline

    // Counter animation for 60ms badge
    // const {count: proofTime, ref: counterRef} = useCounterAnimation({
    //     start: 0, end: 60, duration: 2, suffix: 'ms', triggerOnView: true,
    // });

    // ❌ Commented: Particle system (không cần với Spline)
    // useEffect(() => {
    //   const handleScroll = () => {
    //     const scrollY = window.scrollY;
    //     const viewportHeight = window.innerHeight;
    //     if (scrollY > viewportHeight * 2 && scrollY < viewportHeight * 2.5) {
    //       setShowParticles(true);
    //     } else {
    //       setShowParticles(false);
    //     }
    //   };
    //   window.addEventListener('scroll', handleScroll);
    //   return () => window.removeEventListener('scroll', handleScroll);
    // }, []);

    return (
        <>
        <section ref={ref} className="relative min-h-screen w-full overflow-hidden">
            {/* ✅ Spline 3D Background - FULLSCREEN */}
            <div className="absolute inset-0 z-0">
                <SplineScene
                    sceneUrl="https://prod.spline.design/Q2dmLo5IogYHjFSg/scene.splinecode"

                />
            </div>

            {/* Dark overlay để text dễ đọc hơn */}
            {/*<div className="hero-background absolute inset-0 z-[1] bg-black/30"/>*/}

            {/*<motion.div*/}
            {/*    ref={heroRef as any}*/}
            {/*    className="max-w-[1440px] mx-auto px-12 relative z-10 min-h-screen flex items-center pt-20"*/}
            {/*    style={{y, opacity}}*/}
            {/*>*/}
            {/*    <div className="grid grid-cols-[55%_45%] gap-20 items-center w-full">*/}
            {/*        /!* LEFT - Text with enhanced visibility *!/*/}
            {/*        <div className="space-y-4">*/}
            {/*            <motion.div*/}
            {/*                initial={{opacity: 0, y: 20}}*/}
            {/*                animate={{opacity: 1, y: 0}}*/}
            {/*                transition={{delay: 0.4}}*/}
            {/*                className="inline-block px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-wider leading-[10px] text-[#217D87]"*/}
            {/*                style={{*/}
            {/*                    background: "rgba(33, 125, 135, 0.25)",*/}
            {/*                    border: "1px solid rgba(33, 125, 135, 0.6)",*/}
            {/*                    backdropFilter: "blur(8px)",*/}
            {/*                }}*/}
            {/*            >*/}
            {/*                NEXT GENERATION CRYPTOGRAPHY*/}
            {/*            </motion.div>*/}

            {/*            <motion.div*/}
            {/*                className="hero-heading max-w-[600px] mt-4"*/}
            {/*            >*/}
            {/*                <h1*/}
            {/*                    className="font-bold text-[30px] leading-[31px] text-white mb-[2px]"*/}
            {/*                    style={{*/}
            {/*                        textShadow: "0 2px 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(0, 0, 0, 0.8)"*/}
            {/*                    }}*/}
            {/*                >*/}
            {/*                    <DecryptedText*/}
            {/*                        text="Zero-Knowledge Proofs"*/}
            {/*                        animateOn="both"*/}
            {/*                        speed={60}*/}
            {/*                        maxIterations={12}*/}
            {/*                        sequential={true}*/}
            {/*                        revealDirection="start"*/}
            {/*                        className="text-white"*/}
            {/*                        encryptedClassName="text-[#357F8C]"*/}
            {/*                    />*/}
            {/*                </h1>*/}
            {/*                <h2*/}
            {/*                    className="hero-subtext font-normal text-[28px] leading-[34px] text-[#E5E7EB] mt-2"*/}
            {/*                    style={{*/}
            {/*                        textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)"*/}
            {/*                    }}*/}
            {/*                >*/}
            {/*                    for Trustless Privacy*/}
            {/*                </h2>*/}
            {/*            </motion.div>*/}

            {/*            <motion.p*/}
            {/*                className="hero-subtext text-[14px] leading-[1.6] max-w-[450px] pt-4 text-[#D1D5DB]"*/}
            {/*                style={{*/}
            {/*                    textShadow: "0 1px 8px rgba(0, 0, 0, 0.8)", backdropFilter: "blur(2px)",*/}
            {/*                }}*/}
            {/*            >*/}
            {/*                Zero-knowledge method rigorously proves valid statements without revealing your*/}
            {/*                certification. Enable*/}
            {/*                private transactions, identity compliance, and trustless verification on Web3.*/}
            {/*            </motion.p>*/}

            {/*            <motion.div*/}
            {/*                className="flex items-center gap-3 pt-3"*/}
            {/*            >*/}
            {/*                <motion.button*/}
            {/*                    className="hero-button px-5 py-2.5 rounded-full text-[13px] font-semibold text-white border border-transparent"*/}
            {/*                    style={{*/}
            {/*                        background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",*/}
            {/*                        boxShadow: "0 4px 24px rgba(139, 92, 246, 0.5)",*/}
            {/*                    }}*/}
            {/*                    whileHover={{*/}
            {/*                        y: -2, boxShadow: "0 8px 32px rgba(139, 92, 246, 0.7)",*/}
            {/*                    }}*/}
            {/*                    whileTap={{scale: 0.98}}*/}
            {/*                >*/}
            {/*                    Explore Docs <ArrowRight className="w-3.5 h-3.5 inline ml-1.5"/>*/}
            {/*                </motion.button>*/}

            {/*                <motion.button*/}
            {/*                    className="hero-button px-5 py-2.5 rounded-full text-[13px] font-semibold text-white border-[1.5px] border-white/20 bg-transparent"*/}
            {/*                    whileHover={{*/}
            {/*                        borderColor: "rgba(53, 127, 140, 0.6)", background: "rgba(53, 127, 140, 0.1)",*/}
            {/*                    }}*/}
            {/*                    whileTap={{scale: 0.98}}*/}
            {/*                >*/}
            {/*                    <PlayCircle className="w-3.5 h-3.5 inline mr-1.5"/>*/}
            {/*                    Watch Demo*/}
            {/*                </motion.button>*/}
            {/*            </motion.div>*/}
            {/*        </div>*/}

            {/*        /!* RIGHT - Badge Only (Spline ở background) *!/*/}
            {/*        <motion.div*/}
            {/*            ref={cubeRef}*/}
            {/*            className="hero-cube relative flex items-center justify-center h-[400px]"*/}
            {/*        >*/}
            {/*            /!* 60ms Badge with animated counter *!/*/}
            {/*            <motion.div*/}
            {/*                ref={counterRef as any}*/}
            {/*                initial={{opacity: 0, scale: 0.8}}*/}
            {/*                animate={{opacity: 1, scale: 1}}*/}
            {/*                transition={{delay: 1.2}}*/}
            {/*                className="flex flex-col gap-1 px-3 py-2.5 rounded-lg z-10"*/}
            {/*                style={{*/}
            {/*                    background: "rgba(40, 37, 55, 0.8)",*/}
            {/*                    backdropFilter: "blur(12px)",*/}
            {/*                    border: "1px solid rgba(53, 127, 140, 0.3)",*/}
            {/*                }}*/}
            {/*            >*/}
            {/*                <div className="flex items-center gap-2">*/}
            {/*                    <Lock className="w-3.5 h-3.5 text-[#357F8C]"/>*/}
            {/*                    <span className="text-[13px] font-bold text-[#357F8C]">*/}
            {/*        {proofTime}*/}
            {/*      </span>*/}
            {/*                </div>*/}
            {/*                <span className="text-[9px] text-[#94A3B8] leading-tight">*/}
            {/*      Average proof time*/}
            {/*    </span>*/}
            {/*            </motion.div>*/}
            {/*        </motion.div>*/}
            {/*    </div>*/}
            {/*</motion.div>*/}
        </section>

        {/* ❌ Commented: Particle System (không cần với Spline) */}
        {/* <ParticleSystem
        trigger={showParticles}
        particleCount={80}
        colors={['#8B5CF6', '#3B82F6', '#357F8C']}
      /> */}
    </>);
}
