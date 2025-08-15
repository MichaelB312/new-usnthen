// components/book-preview/EnhancedCanvas.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { PageLayout, LayoutElement } from '@/lib/layout/EnhancedLayoutEngine';

// Try to import react-konva if available
let Stage: any, Layer: any, KonvaImage: any, Text: any, Rect: any, Group: any;
let Konva: any;

try {
  const konvaImports = require('react-konva');
  Stage = konvaImports.Stage;
  Layer = konvaImports.Layer;
  KonvaImage = konvaImports.Image;
  Text = konvaImports.Text;
  Rect = konvaImports.Rect;
  Group = konvaImports.Group;
  Konva = require('konva');
} catch (e) {
  console.warn('React-Konva not available, using fallback canvas rendering');
}

interface EnhancedCanvasProps {
  layout: PageLayout;
  width: number;
  height: number;
  showGuides?: boolean;
  showBleed?: boolean;
  showGutter?: boolean;
  onExport?: (dataUrl: string) => void;
}

export function EnhancedCanvas({ 
  layout, 
  width, 
  height,
  showGuides = false,
  showBleed = false,
  showGutter = false,
  onExport
}: EnhancedCanvasProps) {
  const stageRef = useRef<any>(null);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // If react-konva is not available, use fallback canvas
  if (!Stage) {
    return (
      <div style={{ width, height }} className="relative">
        <canvas 
          width={width}
          height={height}
          className="w-full h-full"
        />
        <p className="absolute top-2 left-2 text-xs text-gray-500">
          Install react-konva for enhanced preview
        </p>
      </div>
    );
  }
  
  // Calculate scale to fit display
  const scaleX = width / layout.canvas.width;
  const scaleY = height / layout.canvas.height;
  const scale = Math.min(scaleX, scaleY);
  
  // Load all images
  useEffect(() => {
    const loadImages = async () => {
      const imageElements = layout.elements.filter(el => el.type === 'image' && el.url);
      const loadedImages: Record<string, HTMLImageElement> = {};
      
      await Promise.all(
        imageElements.map(async (element) => {
          if (element.url) {
            return new Promise<void>((resolve) => {
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                loadedImages[element.id] = img;
                resolve();
              };
              img.onerror = () => {
                console.error(`Failed to load image: ${element.url}`);
                resolve();
              };
              img.src = element.url || '';
            });
          }
        })
      );
      
      setImages(loadedImages);
      setIsLoading(false);
    };
    
    loadImages();
  }, [layout]);
  
  // Export high-quality image
  const exportImage = () => {
    if (!stageRef.current) return;
    
    // Temporarily scale up for export
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    
    // Export at print resolution
    stage.scale({ x: 1, y: 1 });
    stage.size({ 
      width: layout.canvas.width, 
      height: layout.canvas.height 
    });
    
    const dataUrl = stage.toDataURL({
      pixelRatio: 1,
      mimeType: 'image/png',
      quality: 1
    });
    
    // Restore display scale
    stage.scale({ x: scale, y: scale });
    stage.size({ width, height });
    
    if (onExport) {
      onExport(dataUrl);
    }
  };
  
  // Render element based on type
  const renderElement = (element: LayoutElement) => {
    switch (element.type) {
      case 'image':
        const img = images[element.id];
        if (!img) return null;
        
        return (
          <KonvaImage
            key={element.id}
            image={img}
            x={element.x - element.width / 2}
            y={element.y - element.height / 2}
            width={element.width}
            height={element.height}
            rotation={element.rotation}
            offsetX={0}
            offsetY={0}
          />
        );
        
      case 'text':
        // Create text background if specified or if it's the plaque
        const textGroup = [];
        
        if (element.id === 'text_plaque') {
          // This is the background plaque for text
          textGroup.push(
            <Rect
              key={element.id}
              x={element.x - element.width / 2}
              y={element.y - element.height / 2}
              width={element.width}
              height={element.height}
              fill={element.style?.background_color || 'rgba(255, 255, 255, 0.95)'}
              cornerRadius={10}
              rotation={element.rotation}
            />
          );
        } else if (element.style?.background_color) {
          // Regular text with optional background
          const padding = element.style.padding || 20;
          textGroup.push(
            <Rect
              key={`${element.id}_bg`}
              x={element.x - element.width / 2 - padding}
              y={element.y - element.height / 2 - padding}
              width={element.width + padding * 2}
              height={element.height + padding * 2}
              fill={element.style.background_color}
              cornerRadius={10}
              rotation={element.rotation}
            />
          );
        }
        
        // Only render actual text if there's content
        if (element.content) {
          textGroup.push(
            <Text
              key={`${element.id}_text`}
              text={element.content || ''}
              x={element.x - element.width / 2}
              y={element.y - element.height / 2}
              width={element.width}
              height={element.height}
              fontSize={element.style?.font_size_pt || 24}
              fontFamily={element.style?.font_family || 'Patrick Hand'}
              fill={element.style?.color || '#2D3748'}
              align={element.style?.text_align || 'center'}
              verticalAlign="middle"
              lineHeight={element.style?.line_height || 1.4}
              rotation={element.rotation}
              wrap="word"
            />
          );
        }
        
        return textGroup.length > 0 ? <Group key={element.id}>{textGroup}</Group> : null;
        
      default:
        return null;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="relative">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scale={{ x: scale, y: scale }}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={layout.canvas.width}
            height={layout.canvas.height}
            fill="#FFFFFF"
          />
          
          {/* Bleed area (if enabled) */}
          {showBleed && (
            <>
              <Rect
                x={-layout.canvas.bleed}
                y={-layout.canvas.bleed}
                width={layout.canvas.width + layout.canvas.bleed * 2}
                height={layout.canvas.bleed}
                fill="rgba(255, 0, 0, 0.1)"
              />
              <Rect
                x={-layout.canvas.bleed}
                y={layout.canvas.height}
                width={layout.canvas.width + layout.canvas.bleed * 2}
                height={layout.canvas.bleed}
                fill="rgba(255, 0, 0, 0.1)"
              />
              <Rect
                x={-layout.canvas.bleed}
                y={0}
                width={layout.canvas.bleed}
                height={layout.canvas.height}
                fill="rgba(255, 0, 0, 0.1)"
              />
              <Rect
                x={layout.canvas.width}
                y={0}
                width={layout.canvas.bleed}
                height={layout.canvas.height}
                fill="rgba(255, 0, 0, 0.1)"
              />
            </>
          )}
          
          {/* Safe area guides (if enabled) */}
          {showGuides && (
            <Rect
              x={layout.safeArea.x}
              y={layout.safeArea.y}
              width={layout.safeArea.width}
              height={layout.safeArea.height}
              stroke="rgba(0, 255, 0, 0.3)"
              strokeWidth={2}
              fill="transparent"
              dash={[10, 5]}
            />
          )}
          
          {/* Gutter guide (if enabled) */}
          {showGutter && (
            <Rect
              x={layout.gutterArea.x}
              y={layout.gutterArea.y}
              width={layout.gutterArea.width}
              height={layout.gutterArea.height}
              fill="rgba(0, 0, 255, 0.1)"
              stroke="rgba(0, 0, 255, 0.3)"
              strokeWidth={2}
              dash={[10, 5]}
            />
          )}
          
          {/* Render all elements sorted by z-index */}
          {layout.elements
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(element => renderElement(element))}
        </Layer>
      </Stage>
      
      {/* Export button */}
      {onExport && (
        <button
          onClick={exportImage}
          className="absolute top-4 right-4 btn-secondary text-sm"
        >
          Export Print-Ready
        </button>
      )}
    </div>
  );
}