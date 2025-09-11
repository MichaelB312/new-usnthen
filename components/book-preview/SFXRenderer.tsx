// components/book-preview/SFXRenderer.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

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

// Enhanced SFX Detection and Generation
export class SFXGenerator {
  private static SFX_PATTERNS = {
    // Movement sounds
    'run|running|dash|race|racing': ['ZOOM!', 'WHOOSH!', 'DASH!'],
    'jump|jumping|hop|hopping|bounce|bouncing': ['BOING!', 'HOP!', 'BOUNCE!'],
    'fall|falling|tumble|tumbling|drop|dropping': ['THUMP!', 'TUMBLE!', 'OOF!'],
    'crawl|crawling|creep|creeping': ['SHUFFLE!', 'CREEP!'],
    'walk|walking|step|stepping': ['STEP STEP!', 'TAP TAP!'],
    
    // Water sounds
    'splash|splashing|swim|swimming|water': ['SPLASH!', 'SPLISH SPLASH!', 'SWOOSH!'],
    'drip|dripping|drop': ['DRIP!', 'PLOP!'],
    'bath|bathing|wash|washing': ['SPLISH SPLASH!', 'BUBBLE!'],
    
    // Emotional sounds
    'laugh|laughing|giggle|giggling': ['GIGGLE!', 'HA HA!', 'TEE HEE!'],
    'cry|crying|wail|wailing': ['WAAH!', 'SOB!'],
    'sleep|sleeping|snore|snoring': ['ZZZ...', 'SNORE!'],
    'yawn|yawning': ['YAAAWN!'],
    'happy|joy|joyful': ['YAY!', 'WHEEE!'],
    
    // Action sounds
    'eat|eating|munch|munching|chew|chewing': ['MUNCH!', 'YUM!', 'CHOMP!'],
    'clap|clapping|applaud': ['CLAP CLAP!', 'YAY!'],
    'knock|knocking|tap|tapping': ['KNOCK!', 'TAP TAP!'],
    'bang|crash|crashing': ['BANG!', 'CRASH!', 'BOOM!'],
    
    // Animal/Toy sounds
    'quack|duck': ['QUACK!'],
    'beep|car|truck': ['BEEP BEEP!', 'VROOM!'],
    'ring|ringing|bell': ['RING!', 'DING!'],
    'squeak|squeaking|toy': ['SQUEAK!'],
    'meow|cat|kitty': ['MEOW!'],
    'woof|dog|puppy': ['WOOF!'],
    'moo|cow': ['MOO!'],
    
    // Discovery sounds
    'pop|popping|bubble': ['POP!'],
    'surprise|surprised|wow': ['WOW!', 'OH!'],
    'find|finding|discover|discovering': ['AHA!', 'TADA!'],
    'peek|peeking': ['PEEK-A-BOO!'],
    
    // Nature sounds
    'wind|windy': ['WHOOSH!'],
    'thunder': ['BOOM!', 'RUMBLE!'],
    'rain|raining': ['PITTER PATTER!']
  };
  
  /**
   * Automatically detect if narration suggests sound effects
   */
  static detectSFX(narration: string): {
    hasSFX: boolean;
    suggestedSFX: string;
    confidence: number;
    style: 'comic' | 'playful' | 'dramatic' | 'soft';
  } {
    const lowerText = narration.toLowerCase();
    
    // Check each pattern
    for (const [pattern, sfxOptions] of Object.entries(this.SFX_PATTERNS)) {
      const regex = new RegExp(`\\b(${pattern})\\b`);
      if (regex.test(lowerText)) {
        // Pick a random SFX from options
        const sfx = sfxOptions[Math.floor(Math.random() * sfxOptions.length)];
        
        // Determine style based on the SFX and context
        let style: SFXConfig['style'] = 'playful';
        
        // Dramatic sounds
        if (sfx.includes('BOOM') || sfx.includes('CRASH') || sfx.includes('BANG')) {
          style = 'dramatic';
        }
        // Soft sounds
        else if (sfx.includes('ZZZ') || sfx.includes('shh') || sfx.includes('...')) {
          style = 'soft';
        }
        // Comic sounds
        else if (sfx.includes('!') && (sfx.includes('BOING') || sfx.includes('ZOOM'))) {
          style = 'comic';
        }
        
        // Calculate confidence based on how clear the sound indication is
        let confidence = 0.8;
        
        // Higher confidence for exclamation marks in narration
        if (lowerText.includes('!')) {
          confidence = 0.95;
        }
        
        // Higher confidence for onomatopoeia already in text
        if (lowerText.includes('splash') || lowerText.includes('boom') || lowerText.includes('giggle')) {
          confidence = 0.9;
        }
        
        return {
          hasSFX: true,
          suggestedSFX: sfx,
          confidence,
          style
        };
      }
    }
    
    return {
      hasSFX: false,
      suggestedSFX: '',
      confidence: 0,
      style: 'playful'
    };
  }
  
  /**
   * Generate optimal SFX configuration based on page layout
   */
  static generateSFXConfig(
    sfxText: string,
    pageLayout: { width: number; height: number },
    characterPosition?: 'left' | 'right' | 'center'
  ): SFXConfig {
    // Determine style based on text
    let style: SFXConfig['style'] = 'playful';
    
    if (sfxText.includes('BOOM') || sfxText.includes('CRASH') || sfxText.includes('BANG')) {
      style = 'dramatic';
    } else if (sfxText.includes('ZZZ') || sfxText.includes('shh')) {
      style = 'soft';
    } else if (sfxText.includes('!')) {
      style = 'comic';
    }
    
    // Calculate position to avoid character overlap
    let position = { x: 200, y: 150 };
    
    if (characterPosition === 'left') {
      // Place SFX on right side
      position = { x: pageLayout.width * 0.7, y: pageLayout.height * 0.3 };
    } else if (characterPosition === 'right') {
      // Place SFX on left side
      position = { x: pageLayout.width * 0.3, y: pageLayout.height * 0.3 };
    } else if (characterPosition === 'center') {
      // Place SFX in top corner
      position = { x: pageLayout.width * 0.75, y: pageLayout.height * 0.15 };
    } else {
      // No character - place anywhere interesting
      position = { 
        x: pageLayout.width * (0.5 + Math.random() * 0.3), 
        y: pageLayout.height * (0.2 + Math.random() * 0.3) 
      };
    }
    
    // Add some randomness for natural feel
    position.x += (Math.random() - 0.5) * 30;
    position.y += (Math.random() - 0.5) * 20;
    
    // Random rotation for playful effect
    const rotation = -15 + Math.random() * 30;
    
    // Scale based on importance
    let scale = 1;
    if (style === 'dramatic') {
      scale = 1.2;
    } else if (style === 'soft') {
      scale = 0.9;
    }
    
    return {
      text: sfxText,
      style,
      position,
      rotation,
      scale,
      color: undefined // Use default from style
    };
  }
  
  /**
   * Batch process all pages for SFX opportunities
   */
  static processStoryForSFX(pages: any[]): Map<number, SFXConfig> {
    const sfxMap = new Map<number, SFXConfig>();
    
    pages.forEach((page) => {
      const detection = this.detectSFX(page.narration);
      
      if (detection.hasSFX && detection.confidence > 0.7) {
        const config = this.generateSFXConfig(
          detection.suggestedSFX,
          { width: 400, height: 400 }, // Standard page size
          page.characters_on_page?.length > 0 ? 'center' : undefined
        );
        
        sfxMap.set(page.page_number, {
          ...config,
          style: detection.style
        });
      }
    });
    
    return sfxMap;
  }
}