'use client';

import { useEffect, useRef } from 'react';

interface CanvasProps {
  layout: any;
  width: number;
  height: number;
}

export function Canvas({ layout, width, height }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || !layout) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale to fit display size
    const scaleX = width / layout.canvas.width;
    const scaleY = height / layout.canvas.height;
    const scale = Math.min(scaleX, scaleY);
    
    canvas.width = width;
    canvas.height = height;
    
    // Clear and fill background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    // Apply scaling
    ctx.save();
    ctx.scale(scale, scale);
    
    // Center the content
    const offsetX = (width / scale - layout.canvas.width) / 2;
    const offsetY = (height / scale - layout.canvas.height) / 2;
    ctx.translate(offsetX, offsetY);
    
    // Render elements
    layout.elements.forEach((element: any) => {
      ctx.save();
      
      ctx.translate(element.x, element.y);
      ctx.rotate((element.rotation * Math.PI) / 180);
      
      if (element.type === 'text') {
        ctx.font = `${element.style.font_size_pt}pt ${element.style.font_family || 'Patrick Hand'}`;
        ctx.fillStyle = element.style.color || '#2D3748';
        ctx.textAlign = element.style.text_align || 'center';
        ctx.textBaseline = 'middle';
        
        // Simple text rendering (you'd want proper text wrapping here)
        ctx.fillText(element.content || '', 0, 0);
      } else if (element.type === 'image' && element.url) {
        // For now, draw placeholder
        ctx.fillStyle = '#E9D5FF';
        ctx.fillRect(
          -element.width / 2,
          -element.height / 2,
          element.width,
          element.height
        );
      } else if (element.type === 'decoration') {
        // Draw decoration placeholder
        ctx.fillStyle = '#FED7E2';
        ctx.beginPath();
        ctx.arc(0, 0, element.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });
    
    ctx.restore();
  }, [layout, width, height]);
  
  return (
    <canvas 
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
    />
  );
}