// components/book-preview/SFXRenderer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';

export interface SFXConfig {
  text: string;
  style: 'comic' | 'playful' | 'dramatic' | 'soft';
  position: { x: number; y: number };
  rotation?: number;
  scale?: number;
  color?: string;
  fontFamily?: string;
}

interface SFXRendererProps {
  sfxConfig: SFXConfig;
  pageWidth: number;
  pageHeight: number;
  safeMargins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export function SFXRenderer({ 
  sfxConfig, 
  pageWidth, 
  pageHeight,
  safeMargins 
}: SFXRendererProps) {
  // Calculate safe bounds
  const safeBounds = {
    minX: safeMargins.left,
    maxX: pageWidth - safeMargins.right,
    minY: safeMargins.top,
    maxY: pageHeight - safeMargins.bottom
  };
  
  // Ensure SFX stays within safe area
  const clampedPosition = {
    x: Math.max(safeBounds.minX, Math.min(safeBounds.maxX - 100, sfxConfig.position.x)),
    y: Math.max(safeBounds.minY, Math.min(safeBounds.maxY - 50, sfxConfig.position.y))
  };
  
  // Style presets
  const stylePresets = {
    comic: {
      fontFamily: 'Comic Sans MS, Patrick Hand, cursive',
      fontSize: '32px',
      fontWeight: 'bold',
      color: sfxConfig.color || '#FF6B6B',
      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
      letterSpacing: '2px'
    },
    playful: {
      fontFamily: 'Patrick Hand, cursive',
      fontSize: '28px',
      fontWeight: '600',
      color: sfxConfig.color || '#9B59B6',
      textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
      letterSpacing: '1px'
    },
    dramatic: {
      fontFamily: 'Impact, sans-serif',
      fontSize: '36px',
      fontWeight: 'bold',
      color: sfxConfig.color || '#E74C3C',
      textShadow: '3px 3px 6px rgba(0,0,0,0.4)',
      letterSpacing: '3px'
    },
    soft: {
      fontFamily: 'Caveat, cursive',
      fontSize: '24px',
      fontWeight: 'normal',
      color: sfxConfig.color || '#3498DB',
      textShadow: '1px 1px 1px rgba(0,0,0,0.1)',
      letterSpacing: '0px'
    }
  };
  
  const selectedStyle = stylePresets[sfxConfig.style];
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${clampedPosition.x}px`,
        top: `${clampedPosition.y}px`,
        transform: `rotate(${sfxConfig.rotation || -15}deg) scale(${sfxConfig.scale || 1})`,
        transformOrigin: 'center'
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: sfxConfig.scale || 1, opacity: 1 }}
      transition={{ 
        type: 'spring',
        stiffness: 200,
        damping: 10
      }}
    >
      <span style={selectedStyle}>
        {sfxConfig.text}
      </span>
    </motion.div>
  );
}

// SFX Detection and Generation
export class SFXGenerator {
  private static SFX_PATTERNS = {
    // Movement sounds
    'run|dash|race': ['ZOOM!', 'WHOOSH!', 'DASH!'],
    'jump|hop|bounce': ['BOING!', 'HOP!', 'BOUNCE!'],
    'fall|tumble|drop': ['THUMP!', 'TUMBLE!', 'OOF!'],
    'crawl|creep': ['SHUFFLE!', 'CREEP!'],
    
    // Water sounds
    'splash|swim|water': ['SPLASH!', 'SPLISH!', 'SWOOSH!'],
    'drip|drop': ['DRIP!', 'PLOP!'],
    'bath|wash': ['SPLISH SPLASH!', 'BUBBLE!'],
    
    // Emotional sounds
    'laugh|giggle': ['GIGGLE!', 'HA HA!', 'TEE HEE!'],
    'cry|wail': ['WAAH!', 'SOB!'],
    'sleep|snore': ['ZZZ...', 'SNORE!'],
    'yawn': ['YAAAWN!'],
    
    // Action sounds
    'eat|munch|chew': ['MUNCH!', 'YUM!', 'CHOMP!'],
    'clap|applaud': ['CLAP CLAP!', 'YAY!'],
    'knock|tap': ['KNOCK!', 'TAP TAP!'],
    'bang|crash': ['BANG!', 'CRASH!', 'BOOM!'],
    
    // Animal/Toy sounds
    'quack|duck': ['QUACK!'],
    'beep|car': ['BEEP BEEP!', 'VROOM!'],
    'ring|bell': ['RING!', 'DING!'],
    'squeak|toy': ['SQUEAK!'],
    
    // Discovery sounds
    'pop|bubble': ['POP!'],
    'surprise|wow': ['WOW!', 'OH!'],
    'find|discover': ['AHA!', 'TADA!']
  };
  
  /**
   * Detect if narration suggests sound effects
   */
  static detectSFX(narration: string): {
    hasSFX: boolean;
    suggestedSFX: string;
    confidence: number;
  } {
    const lowerText = narration.toLowerCase();
    
    for (const [pattern, sfxOptions] of Object.entries(this.SFX_PATTERNS)) {
      const regex = new RegExp(pattern);
      if (regex.test(lowerText)) {
        // Pick a random SFX from options
        const sfx = sfxOptions[Math.floor(Math.random() * sfxOptions.length)];
        
        // Calculate confidence based on how clear the sound indication is
        let confidence = 0.8;
        if (lowerText.includes('!') || lowerText.includes('loud')) {
          confidence = 0.95;
        }
        
        return {
          hasSFX: true,
          suggestedSFX: sfx,
          confidence
        };
      }
    }
    
    return {
      hasSFX: false,
      suggestedSFX: '',
      confidence: 0
    };
  }
  
  /**
   * Generate SFX configuration based on page layout
   */
  static generateSFXConfig(
    sfxText: string,
    pageLayout: any,
    characterPosition?: 'left' | 'right' | 'center'
  ): SFXConfig {
    // Determine style based on text
    let style: SFXConfig['style'] = 'playful';
    if (sfxText.includes('BOOM') || sfxText.includes('CRASH')) {
      style = 'dramatic';
    } else if (sfxText.includes('ZZZ') || sfxText.includes('shh')) {
      style = 'soft';
    } else if (sfxText.includes('!')) {
      style = 'comic';
    }
    
    // Calculate position based on character placement
    let position = { x: 200, y: 150 };
    
    if (characterPosition === 'left') {
      // Place SFX on right side
      position = { x: pageLayout.width * 0.7, y: pageLayout.height * 0.3 };
    } else if (characterPosition === 'right') {
      // Place SFX on left side
      position = { x: pageLayout.width * 0.3, y: pageLayout.height * 0.3 };
    } else {
      // Center or no character - place top right
      position = { x: pageLayout.width * 0.75, y: pageLayout.height * 0.2 };
    }
    
    // Add some randomness for natural feel
    position.x += (Math.random() - 0.5) * 50;
    position.y += (Math.random() - 0.5) * 30;
    
    // Random rotation for playful effect
    const rotation = -15 + Math.random() * 30;
    
    return {
      text: sfxText,
      style,
      position,
      rotation,
      scale: 1,
      color: undefined // Use default from style
    };
  }
}

// Integration Component
export function BookPreviewWithSFX() {
  const { storyData } = useBookStore();
  const [sfxEnabled, setSfxEnabled] = useState<Record<number, boolean>>({});
  const [sfxTexts, setSfxTexts] = useState<Record<number, string>>({});
  
  // Auto-detect SFX opportunities
  useEffect(() => {
    if (!storyData?.pages) return;
    
    const detectedSFX: Record<number, string> = {};
    
    storyData.pages.forEach((page: any) => {
      const detection = SFXGenerator.detectSFX(page.narration);
      if (detection.hasSFX && detection.confidence > 0.7) {
        detectedSFX[page.page_number] = detection.suggestedSFX;
      }
    });
    
    setSfxTexts(detectedSFX);
  }, [storyData]);
  
  return (
    <div className="space-y-4">
      {/* SFX Controls */}
      <div className="card-magical">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Sound Effects
        </h3>
        
        <div className="space-y-2">
          {Object.entries(sfxTexts).map(([pageNum, sfx]) => (
            <div key={pageNum} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-sm">
                Page {pageNum}: {sfx}
              </span>
              <button
                onClick={() => setSfxEnabled((prev: Record<number, boolean>) => ({
                  ...prev,
                  [Number(pageNum)]: !prev[Number(pageNum)]
                }))}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  sfxEnabled[Number(pageNum)]
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {sfxEnabled[Number(pageNum)] ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
        
        {Object.keys(sfxTexts).length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No sound effects detected in this story
          </p>
        )}
      </div>
    </div>
  );
}