"use client";

import { memo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// ✅ Import Spline với proper error handling
const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => null, // ✅ Dùng null thay vì div để tránh layout shift
});

interface SplineSceneProps {
  sceneUrl: string;
  enableInteraction?: boolean;
}

const SplineScene = memo(({ sceneUrl, enableInteraction = true }: SplineSceneProps) => {
  const router = useRouter();

  // ✅ Cleanup cursor
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

  // ✅ Handle click
  function onSplineClick(e: any) {
    if (!enableInteraction) {
      console.log('Interaction disabled');
      return; // ✅ FIX: Thêm return
    }

    const targetName = e.target?.name;
    console.log('🖱️ Clicked:', targetName);

    switch(targetName) {
      case 'ACCESS TERMINAL':
      case 'TERMINAL':
        console.log('Opening terminal...');
        break;

      case 'TRANSMISSION LOGS':
      case 'LOGS':
        console.log('Opening logs...');
        break;

      case 'BIO ARCHIVE':
      case 'ARCHIVE':
        console.log('Opening archive...');
        break;

      case 'INITIATE CONTACT':
      case 'CONTACT':
        console.log('Initiating contact...');
        router.push('/contact');
        break;

      case 'JOIN THE HARVEST':
      case 'HARVEST':
      case 'JOIN':
        console.log('🚀 Navigating to Trading Dashboard...');
        router.push('/tradingdashboard/btc-usdc');
        break;

      case 'EXPLORE DOCS':
      case 'DOCS':
        console.log('Opening docs...');
        router.push('/docs');
        break;

      case 'WATCH DEMO':
      case 'DEMO':
        console.log('Playing demo...');
        break;

      default:
        if (targetName) {
          console.log('⚠️ Unhandled click:', targetName);
        }
        break;
    }
  }

  // ✅ Handle hover
  function onSplineHover(e: any) {
    if (!enableInteraction) return;

    const targetName = e.target?.name;

    if (targetName && (
        targetName.includes('JOIN') ||
        targetName.includes('HARVEST') ||
        targetName.includes('CONTACT') ||
        targetName.includes('TERMINAL') ||
        targetName.includes('DOCS') ||
        targetName.includes('DEMO')
    )) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  }

  // ✅ Validate sceneUrl
  if (!sceneUrl) {
    console.error('❌ Missing sceneUrl prop');
    return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-red-500">Error: Missing scene URL</p>
        </div>
    );
  }

  return (
      <div
          className="w-full h-full relative"
          style={{ overflow: 'hidden' }}
      >
        <Spline
            scene={sceneUrl}
            // ✅ FIX: Dùng inline style thay vì style object
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: enableInteraction ? 'auto' : 'none', // ✅ Thêm dòng này
            }}
            onLoad={() => {
              console.log('✅ Spline scene loaded successfully');
            }}
            onError={(error: any) => {
              console.error('❌ Spline error:', error);
            }}
            // ✅ FIX: THÊM 2 DÒNG NÀY!
            onSplineMouseDown={onSplineClick}
            onSplineMouseHover={onSplineHover}
        />
      </div>
  );
});

SplineScene.displayName = 'SplineScene';

export default SplineScene;
