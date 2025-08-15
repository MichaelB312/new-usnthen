// components/book-preview/Canvas.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
// Don't import Rect type at all since we don't use it directly
import { PageLayout, LayoutElement, CANVAS_W, CANVAS_H, SAFE, GUTTER, BLEED } from '@/lib/layout/EnhancedLayoutEngine';
import { FileDown } from 'lucide-react';

// Try to import react-konva if available
let Stage: any, Layer: any, KonvaImage: any, Text: any, KonvaRect: any, Group: any, Line: any;
let Konva: any;

try {
  const konvaImports = require('react-konva');
  Stage = konvaImports.Stage;
  Layer = konvaImports.Layer;
  KonvaImage = konvaImports.Image;
  Text = konvaImports.Text;
  KonvaRect = konvaImports.Rect;  // Rename to KonvaRect to avoid conflicts
  Group = konvaImports.Group;
  Line = konvaImports.Line;
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
  const [exportMode, setExportMode] = useState(false);
  
  // If react-konva is not available, use fallback canvas
  if (!Stage) {
    return (
      <FallbackCanvas 
        layout={layout}
        width={width}
        height={height}
        showGuides={showGuides}
        showBleed={showBleed}
        showGutter={showGutter}
        onExport={onExport}
      />
    );
  }
  
  // Calculate scale to fit display
  const scaleX = width / CANVAS_W;
  const scaleY = height / CANVAS_H;
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
  
  // Export high-quality image at print resolution
  const exportImage = () => {
    if (!stageRef.current) return;
    
    setExportMode(true);
    const stage = stageRef.current;
    
    // Temporarily scale up for export at print resolution
    const oldScale = stage.scaleX();
    stage.scale({ x: 1, y: 1 });
    stage.size({ 
      width: CANVAS_W, 
      height: CANVAS_H 
    });
    
    // Export at 300 DPI (use pixelRatio: 3 for high quality)
    const dataUrl = stage.toDataURL({
      pixelRatio: 3, // High quality export
      mimeType: 'image/png',
      quality: 1
    });
    
    // Restore display scale
    stage.scale({ x: scale, y: scale });
    stage.size({ width, height });
    setExportMode(false);
    
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
          />
        );
        
      case 'text':
        const textGroup = [];
        
        // Text background plaque
        if (element.id === 'text_plaque' || element.style?.background_color) {
          const padding = element.style?.padding || 20;
          textGroup.push(
            <KonvaRect
              key={`${element.id}_bg`}
              x={element.x - element.width / 2 - padding}
              y={element.y - element.height / 2 - padding}
              width={element.width + padding * 2}
              height={element.height + padding * 2}
              fill={element.style?.background_color || 'rgba(255, 255, 255, 0.95)'}
              cornerRadius={15}
              rotation={element.rotation}
              shadowColor="rgba(0,0,0,0.1)"
              shadowBlur={10}
              shadowOffsetX={0}
              shadowOffsetY={5}
            />
          );
        }
        
        // Only render text if there's content
        if (element.content) {
          textGroup.push(
            <Text
              key={`${element.id}_text`}
              text={element.content || ''}
              x={element.x - element.width / 2}
              y={element.y - element.height / 2}
              width={element.width}
              height={element.height}
              fontSize={element.style?.font_size_pt || 42} // Large toddler-friendly font
              fontFamily={element.style?.font_family || 'Patrick Hand'}
              fill={element.style?.color || '#2D3748'}
              align={element.style?.text_align || 'center'}
              verticalAlign="middle"
              lineHeight={element.style?.line_height || 1.6}
              rotation={element.rotation}
              wrap="word"
              fontStyle={element.style?.font_weight ? `${element.style.font_weight} ` : ''}
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
          <KonvaRect
            x={0}
            y={0}
            width={CANVAS_W}
            height={CANVAS_H}
            fill="#FFFFFF"
          />
          
          {/* Bleed area (if enabled) */}
          {showBleed && (
            <Group opacity={0.3}>
              {/* Top bleed */}
              <KonvaRect
                x={-BLEED}
                y={-BLEED}
                width={CANVAS_W + BLEED * 2}
                height={BLEED}
                fill="red"
              />
              {/* Bottom bleed */}
              <KonvaRect
                x={-BLEED}
                y={CANVAS_H}
                width={CANVAS_W + BLEED * 2}
                height={BLEED}
                fill="red"
              />
              {/* Left bleed */}
              <KonvaRect
                x={-BLEED}
                y={0}
                width={BLEED}
                height={CANVAS_H}
                fill="red"
              />
              {/* Right bleed */}
              <KonvaRect
                x={CANVAS_W}
                y={0}
                width={BLEED}
                height={CANVAS_H}
                fill="red"
              />
            </Group>
          )}
          
          {/* Safe area guides (if enabled) */}
          {showGuides && layout.safeArea && (
            <KonvaRect
              x={layout.safeArea.x}
              y={layout.safeArea.y}
              width={layout.safeArea.w}
              height={layout.safeArea.h}
              stroke="rgba(0, 255, 0, 0.5)"
              strokeWidth={3}
              fill="transparent"
              dash={[15, 10]}
            />
          )}
          
          {/* Gutter guide (if enabled) */}
          {showGutter && layout.gutterArea && (
            <Group>
              <KonvaRect
                x={layout.gutterArea.x}
                y={layout.gutterArea.y}
                width={layout.gutterArea.w}
                height={layout.gutterArea.h}
                fill="rgba(0, 0, 255, 0.1)"
              />
              <Line
                points={[
                  CANVAS_W / 2, 0,
                  CANVAS_W / 2, CANVAS_H
                ]}
                stroke="rgba(0, 0, 255, 0.5)"
                strokeWidth={2}
                dash={[10, 5]}
              />
            </Group>
          )}
          
          {/* Render all elements sorted by z-index */}
          {layout.elements
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(element => renderElement(element))}
          
          {/* Layout mode indicator */}
          {showGuides && layout.mode && (
            <Text
              text={`Mode: ${layout.mode} | Shot: ${layout.shot}`}
              x={10}
              y={10}
              fontSize={14}
              fill="rgba(0,0,0,0.5)"
              fontFamily="monospace"
            />
          )}
        </Layer>
      </Stage>
      
      {/* Export controls */}
      {onExport && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={exportImage}
            disabled={exportMode}
            className="btn-secondary text-sm flex items-center gap-2 bg-white/90 backdrop-blur"
          >
            <FileDown className="h-4 w-4" />
            {exportMode ? 'Exporting...' : 'Export Print-Ready'}
          </button>
        </div>
      )}
      
      {/* Print specs indicator */}
      {showGuides && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg p-2 text-xs">
          <div className="font-mono">
            <div>Canvas: {CANVAS_W}×{CANVAS_H}px @ 300dpi</div>
            <div>Safe: {SAFE}px margin</div>
            <div>Gutter: {GUTTER}px</div>
            <div>Bleed: {BLEED}px</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback canvas implementation when Konva is not available
function FallbackCanvas({ 
  layout, 
  width, 
  height,
  showGuides,
  showBleed,
  showGutter,
  onExport
}: EnhancedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    // Scale to fit
    const scale = Math.min(width / CANVAS_W, height / CANVAS_H);
    ctx.save();
    ctx.scale(scale, scale);
    
    // Draw guides if enabled
    if (showGuides && layout.safeArea) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([15, 10]);
      ctx.strokeRect(
        layout.safeArea.x,
        layout.safeArea.y,
        layout.safeArea.w,
        layout.safeArea.h
      );
      ctx.setLineDash([]);
    }
    
    if (showGutter && layout.gutterArea) {
      ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
      ctx.fillRect(
        layout.gutterArea.x,
        layout.gutterArea.y,
        layout.gutterArea.w,
        layout.gutterArea.h
      );
    }
    
    // Draw placeholder for elements
    ctx.fillStyle = '#E9D5FF';
    ctx.fillRect(100, 100, CANVAS_W - 200, CANVAS_H - 200);
    
    // Draw text
    ctx.fillStyle = '#4C1D95';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Install react-konva for full preview', CANVAS_W / 2, CANVAS_H / 2);
    
    ctx.restore();
  }, [layout, width, height, showGuides, showBleed, showGutter]);
  
  const handleExport = () => {
    if (canvasRef.current && onExport) {
      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      onExport(dataUrl);
    }
  };
  
  return (
    <div className="relative">
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
      />
      <div className="absolute top-2 left-2 text-xs text-gray-500 bg-white/90 p-2 rounded">
        Install react-konva for enhanced preview
      </div>
      {onExport && (
        <button
          onClick={handleExport}
          className="absolute top-4 right-4 btn-secondary text-sm"
        >
          Export (Basic)
        </button>
      )}
    </div>
  );
}