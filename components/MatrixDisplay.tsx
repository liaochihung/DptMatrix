
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MatrixConfig, DotShape, AnimationEffect } from '../types';

interface MatrixDisplayProps {
  config: MatrixConfig;
  matrix: boolean[][];
}

export interface MatrixDisplayHandle {
  getCanvas: () => HTMLCanvasElement | null;
  resetAnimation: () => void;
}

const MatrixDisplay = forwardRef<MatrixDisplayHandle, MatrixDisplayProps>(({ config, matrix }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    resetAnimation: () => {
      setOffset(0);
      lastUpdateRef.current = performance.now();
    }
  }));

  useEffect(() => {
    const animate = (time: number) => {
      const deltaTime = time - lastUpdateRef.current;
      const updateInterval = 1000 / (config.speed * 2); 
      
      if (deltaTime > updateInterval) {
        if (config.effect === AnimationEffect.SCROLL_LEFT) {
          setOffset(prev => (prev + 1) % (matrix[0]?.length || config.cols || 1));
        } else if (config.effect === AnimationEffect.SCROLL_RIGHT) {
          setOffset(prev => (prev - 1 + (matrix[0]?.length || config.cols || 1)) % (matrix[0]?.length || config.cols || 1));
        }
        lastUpdateRef.current = time;
      }

      draw();
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [config.effect, config.speed, matrix, config, offset]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { rows, cols, dotSize, gap, color, offColor, bgColor, shape, brightness, bloom } = config;
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const totalDotSize = dotSize + gap;
    const time = Date.now() / 1000;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sourceX = c;
        if (config.effect === AnimationEffect.SCROLL_LEFT || config.effect === AnimationEffect.SCROLL_RIGHT) {
          const mWidth = matrix[0]?.length || 1;
          sourceX = (c + offset) % mWidth;
        }
        
        const isActive = matrix[r] && matrix[r][sourceX];
        let currentOpacity = isActive ? brightness / 100 : 0.15;

        if (isActive) {
           if (config.effect === AnimationEffect.PULSE) {
              currentOpacity *= (0.6 + Math.sin(time * config.speed * 0.5) * 0.4);
           } else if (config.effect === AnimationEffect.SCANLINE) {
              const scanPos = (time * config.speed * 10) % rows;
              if (Math.abs(r - scanPos) < 2) currentOpacity = Math.min(1, currentOpacity * 1.5);
           } else if (config.effect === AnimationEffect.WAVE) {
              const wave = Math.sin(c * 0.2 + time * config.speed * 0.5) * 5;
              if (Math.abs(r - (rows/2 + wave)) > rows/3) currentOpacity *= 0.3;
           }
        }

        const x = c * totalDotSize + gap;
        const y = r * totalDotSize + gap;

        ctx.fillStyle = isActive ? color : offColor;
        ctx.globalAlpha = currentOpacity;

        if (isActive && bloom > 0) {
          ctx.shadowBlur = bloom;
          ctx.shadowColor = color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        switch (shape) {
          case DotShape.CIRCLE:
            ctx.arc(x + dotSize / 2, y + dotSize / 2, dotSize / 2, 0, Math.PI * 2);
            break;
          case DotShape.SQUARE:
            ctx.rect(x, y, dotSize, dotSize);
            break;
          case DotShape.DIAMOND:
            ctx.moveTo(x + dotSize / 2, y);
            ctx.lineTo(x + dotSize, y + dotSize / 2);
            ctx.lineTo(x + dotSize / 2, y + dotSize);
            ctx.lineTo(x, y + dotSize / 2);
            break;
          case DotShape.TRIANGLE:
            ctx.moveTo(x + dotSize / 2, y);
            ctx.lineTo(x + dotSize, y + dotSize);
            ctx.lineTo(x, y + dotSize);
            break;
        }
        ctx.fill();
        ctx.closePath();
      }
    }
    ctx.globalAlpha = 1.0;
  };

  return (
    <div className="flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden p-8 border-r border-neutral-800">
      <div className="relative border-8 border-neutral-900 rounded-2xl bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={config.cols * (config.dotSize + config.gap) + config.gap}
          height={config.rows * (config.dotSize + config.gap) + config.gap}
          className="max-w-full max-h-[85vh] object-contain"
        />
        <div className="absolute top-2 left-4 text-[10px] text-neutral-700 font-mono tracking-widest uppercase">Engine: 0x82fb | Latency: 2ms</div>
        <div className="absolute bottom-2 right-4 text-[10px] text-neutral-700 font-mono tracking-widest uppercase">{config.cols}x{config.rows} RESOLUTION</div>
      </div>
    </div>
  );
});

export default MatrixDisplay;
