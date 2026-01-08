"use client";

import Header from "./Header";
import HeroLanding from "./HeroLanding";
import ThreeCardSection from "./ThreeCardSection";
import WaveSeparator from "./WaveSeparator";
import TradingShowcase from "./TradingShowcase";
import KeyFeatures from "./KeyFeatures";
import RealWorldApplications from "./RealWorldApplications";
import JoinCommunity from "./JoinCommunity";
import Footer from "./Footer";
import SplineEventLogger from "../SplineEventLogger";

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden relative bg-black">
      {/* Pattern Background Image */}
      {/*<div*/}
      {/*  className="absolute inset-0 z-0"*/}
      {/*  style={{*/}
      {/*    backgroundImage: "url('/layout.png')",*/}
      {/*    backgroundSize: "100% auto",*/}
      {/*    backgroundPosition: "top center",*/}
      {/*    backgroundRepeat: "no-repeat",*/}
      {/*    backgroundColor: "#000000",*/}
      {/*  }}*/}
      {/*/>*/}

      {/* Content */}
      <div className="relative z-10">
        {/*<Header />*/}
        <HeroLanding />
        <ThreeCardSection />
        <WaveSeparator />
        <TradingShowcase />
        <KeyFeatures />
        <RealWorldApplications />
        <JoinCommunity />
        <Footer />
      </div>

      {/* ✅ Spline Event Logger (for debugging) */}
      <SplineEventLogger />
    </div>
  );
}
