
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import gifshot from 'gifshot';
import { DotShape, AnimationEffect, MatrixConfig } from './types';
import { MatrixProcessor } from './services/matrixProcessor';
import MatrixDisplay, { MatrixDisplayHandle } from './components/MatrixDisplay';

const DEFAULT_CONFIG: MatrixConfig = {
  rows: 32,
  cols: 80,
  dotSize: 8,
  gap: 2,
  color: '#ff3333',
  offColor: '#1a0505',
  bgColor: '#050505',
  shape: DotShape.CIRCLE,
  brightness: 100,
  bloom: 10,
  effect: AnimationEffect.STATIC,
  speed: 10,
  fontFamily: 'DotGothic16',
  textScale: 0.8,
  vOffset: 0,
  threshold: 128
};

const PRESETS = [
  { name: 'ETen / DOS', color: '#00ff41', off: '#001a06', bg: '#000000', shape: DotShape.SQUARE, font: 'DotGothic16', threshold: 140 },
  { name: 'Amber Terminal', color: '#ffb300', off: '#261b00', bg: '#0d0a00', shape: DotShape.SQUARE, font: 'VT323', threshold: 100 },
  { name: 'Arcade Classic', color: '#33ffff', off: '#001a1a', bg: '#050505', shape: DotShape.CIRCLE, font: 'Press Start 2P', threshold: 128 },
  { name: 'Low-Res LCD', color: '#000000', off: '#7a8c7a', bg: '#8ca68c', shape: DotShape.SQUARE, font: 'Silkscreen', threshold: 128 },
];

const FONTS = [
  { name: 'Pixel CJK (DotGothic)', value: 'DotGothic16' },
  { name: 'Retro English (VT323)', value: 'VT323' },
  { name: '8-Bit Arcade', value: 'Press Start 2P' },
  { name: 'Tiny Silkscreen', value: 'Silkscreen' },
  { name: 'Tech Mono', value: 'JetBrains Mono' },
  { name: 'Standard Sans', value: 'Inter' },
];

const App: React.FC = () => {
  const [config, setConfig] = useState<MatrixConfig>(DEFAULT_CONFIG);
  const [textInput, setTextInput] = useState("Hello World");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [matrix, setMatrix] = useState<boolean[][]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDuration, setExportDuration] = useState(3);
  const [exportPauseDuration, setExportPauseDuration] = useState(0.8);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  
  const fontInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const matrixRef = useRef<MatrixDisplayHandle>(null);

  const refreshMatrix = useCallback(async () => {
    if (imageFile) {
      const newMatrix = await MatrixProcessor.imageToMatrix(imageFile, config.rows, config.cols, config.threshold);
      setMatrix(newMatrix);
    } else {
      const newMatrix = await MatrixProcessor.textToMatrix(textInput, config);
      setMatrix(newMatrix);
    }
  }, [textInput, imageFile, config]);

  useEffect(() => {
    refreshMatrix();
  }, [refreshMatrix]);

  const suggestedDuration = useMemo(() => {
    const { speed, effect } = config;
    const matrixWidth = matrix[0]?.length || 1;
    
    if (effect === AnimationEffect.SCROLL_LEFT || effect === AnimationEffect.SCROLL_RIGHT) {
      const timeForOneLoop = matrixWidth / (speed * 2);
      return Math.min(10, Math.max(1, parseFloat(timeForOneLoop.toFixed(1))));
    }
    if (effect === AnimationEffect.PULSE) {
      const cycle = (2 * Math.PI) / (speed * 0.5);
      return Math.min(10, Math.max(1, parseFloat(cycle.toFixed(1))));
    }
    return 2.0;
  }, [config.speed, config.effect, matrix]);

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fontName = `Custom-${file.name.replace(/\.[^/.]+$/, "")}`;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const fontFace = new FontFace(fontName, arrayBuffer);
        try {
          const loadedFace = await fontFace.load();
          document.fonts.add(loadedFace);
          setCustomFonts(prev => [...prev, fontName]);
          setConfig(curr => ({ ...curr, fontFamily: fontName }));
        } catch (err) {
          console.error("Font loading failed:", err);
          alert("Failed to load custom font file.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleExportSvg = () => {
    const { rows, cols, dotSize, gap, color, offColor, bgColor, shape, brightness } = config;
    const totalDotSize = dotSize + gap;
    const width = cols * totalDotSize + gap;
    const height = rows * totalDotSize + gap;

    let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<rect width="100%" height="100%" fill="${bgColor}"/>`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isActive = matrix[r] && matrix[r][c];
        const x = c * totalDotSize + gap;
        const y = r * totalDotSize + gap;
        const fill = isActive ? color : offColor;
        const opacity = isActive ? brightness / 100 : 0.15;

        if (shape === DotShape.CIRCLE) {
          svgContent += `<circle cx="${x + dotSize / 2}" cy="${y + dotSize / 2}" r="${dotSize / 2}" fill="${fill}" fill-opacity="${opacity}"/>`;
        } else if (shape === DotShape.SQUARE) {
          svgContent += `<rect x="${x}" y="${y}" width="${dotSize}" height="${dotSize}" fill="${fill}" fill-opacity="${opacity}"/>`;
        } else if (shape === DotShape.DIAMOND) {
          svgContent += `<polygon points="${x + dotSize / 2},${y} ${x + dotSize},${y + dotSize / 2} ${x + dotSize / 2},${y + dotSize} ${x},${y + dotSize / 2}" fill="${fill}" fill-opacity="${opacity}"/>`;
        } else if (shape === DotShape.TRIANGLE) {
          svgContent += `<polygon points="${x + dotSize / 2},${y} ${x + dotSize},${y + dotSize} ${x},${y + dotSize}" fill="${fill}" fill-opacity="${opacity}"/>`;
        }
      }
    }
    svgContent += '</svg>';

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dot-matrix-pro-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGif = async () => {
    if (!matrixRef.current) return;
    const canvas = matrixRef.current.getCanvas();
    if (!canvas) return;

    if (config.effect === AnimationEffect.STATIC) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `dot-matrix-snapshot-${Date.now()}.png`;
      link.click();
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    matrixRef.current.resetAnimation();
    await new Promise(resolve => setTimeout(resolve, 60));

    const FPS = 15;
    const animationFrameCount = Math.ceil(exportDuration * FPS);
    const pauseFrames = Math.ceil(FPS * exportPauseDuration);
    const totalFramesCount = animationFrameCount + pauseFrames;
    const captureInterval = 1000 / FPS;

    const frames: string[] = [];

    const firstFrame = canvas.toDataURL('image/png');
    for (let p = 0; p < pauseFrames; p++) {
      frames.push(firstFrame);
      setExportProgress(Math.floor(((p + 1) / totalFramesCount) * 100));
    }

    for (let i = 0; i < animationFrameCount; i++) {
      const progress = Math.floor(((pauseFrames + i + 1) / totalFramesCount) * 100);
      setExportProgress(progress);
      frames.push(canvas.toDataURL('image/png'));
      await new Promise(resolve => setTimeout(resolve, captureInterval));
    }

    gifshot.createGIF({
      images: frames,
      gifWidth: canvas.width,
      gifHeight: canvas.height,
      interval: 1 / FPS,
      numFrames: frames.length,
      frameDuration: 1,
      sampleInterval: 10,
    }, (obj: any) => {
      if (!obj.error) {
        setExportProgress(100);
        const link = document.createElement('a');
        link.href = obj.image;
        link.download = `dot-matrix-anim-${Date.now()}.gif`;
        link.click();
      }
      setIsExporting(false);
    });
  };

  const generateAIPrompt = async () => {
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Give me a short, cool catchphrase for an LED sign based on: ${textInput}. Max 15 chars. Use traditional chinese if appropriate.`,
      });
      const suggestedText = response.text?.trim().replace(/"/g, '') || "ERROR";
      setTextInput(suggestedText);
      setImageFile(null); // Switch back to text
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#080808] text-white">
      <MatrixDisplay ref={matrixRef} config={config} matrix={matrix} />

      <aside className="w-full md:w-[400px] bg-[#0f0f0f] border-l border-neutral-800 overflow-y-auto flex flex-col shadow-2xl">
        <div className="p-6 space-y-8 pb-20">
          <header className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
                DOT MATRIX PRO
              </h1>
              <p className="text-[10px] text-neutral-500 font-mono tracking-widest mt-1">V3.8.0 // MULTIMEDIA ENGINE</p>
            </div>
          </header>

          <section className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {imageFile ? "Image Source Active" : "Text Source Active"}
              </label>
              {!imageFile ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="flex-1 bg-black border border-neutral-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-red-500 font-mono"
                    placeholder="Type message..."
                  />
                  <button 
                    onClick={generateAIPrompt}
                    disabled={isAiLoading}
                    className="bg-neutral-800 hover:bg-neutral-700 w-10 rounded flex items-center justify-center disabled:opacity-50"
                    title="AI Suggestion"
                  >
                    {isAiLoading ? "..." : "AI"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 bg-black rounded border border-neutral-700 flex items-center justify-center text-[8px] font-mono text-neutral-500">IMG</div>
                    <span className="text-xs truncate font-mono text-neutral-300">{imageFile.name}</span>
                  </div>
                  <button 
                    onClick={clearImage}
                    className="text-xs text-red-500 hover:text-red-400 font-bold uppercase tracking-tighter px-2"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={refreshMatrix}
                className="py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded transition-all active:scale-[0.98]"
              >
                Sync Data
              </button>
              <button 
                onClick={() => imageInputRef.current?.click()}
                className="py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-widest rounded transition-all border border-neutral-700"
              >
                {imageFile ? "Change Image" : "Upload Image"}
              </button>
              <input 
                type="file" ref={imageInputRef} onChange={handleImageUpload}
                accept="image/*" className="hidden" 
              />
            </div>
          </section>

          {/* Matrix Controls Section */}
          <section className="space-y-4 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800">
             <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Digital Processing</h3>
             <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400">
                    <span className="font-bold uppercase tracking-widest">Intensity Threshold</span>
                    <span className="font-mono text-blue-400">{config.threshold}</span>
                  </div>
                  <input 
                    type="range" min="1" max="254" step="1"
                    value={config.threshold}
                    onChange={(e) => setConfig({...config, threshold: Number(e.target.value)})}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[8px] text-neutral-600 leading-tight">Controls the contrast mapping. Higher values make the output "sharper" or thinner.</p>
                </div>
             </div>
          </section>

          {/* Export Engine Section */}
          <section className="space-y-4 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                Export Engine
              </h3>
              <span className="text-[9px] text-neutral-500 font-mono uppercase">Render Engine</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Animation Length</span>
                    <button 
                      onClick={() => setExportDuration(suggestedDuration)}
                      className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-[8px] hover:bg-orange-500 hover:text-black transition-colors"
                      title="Auto-calculate duration for one full scroll"
                    >
                      AUTO {suggestedDuration}s
                    </button>
                  </div>
                  <span className="font-mono text-orange-400">{exportDuration.toFixed(1)}s</span>
                </div>
                <input 
                  type="range" min="0.5" max="10" step="0.1"
                  value={exportDuration}
                  onChange={(e) => setExportDuration(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] text-neutral-400">
                  <span className="flex items-center gap-1.5 font-bold uppercase">
                    Read Pause (Still)
                  </span>
                  <span className="font-mono text-orange-400">{exportPauseDuration.toFixed(1)}s</span>
                </div>
                <input 
                  type="range" min="0" max="3" step="0.1"
                  value={exportPauseDuration}
                  onChange={(e) => setExportPauseDuration(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  onClick={handleExportSvg}
                  className="py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] uppercase tracking-widest rounded transition-all border border-neutral-700 shadow-sm"
                >
                  SVG (Vector)
                </button>
                <button 
                  onClick={handleExportGif}
                  disabled={isExporting}
                  className={`py-3 ${isExporting ? 'bg-orange-600 animate-pulse' : 'bg-orange-500 hover:bg-orange-400'} text-black font-black text-[10px] uppercase tracking-widest rounded transition-all shadow-lg flex items-center justify-center gap-2`}
                >
                  {isExporting ? `RENDERING...` : config.effect === AnimationEffect.STATIC ? "CAPTURE IMAGE" : "EXPORT GIF"}
                </button>
              </div>
            </div>
            {isExporting && (
              <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden mt-2">
                <div className="bg-white h-full transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
              </div>
            )}
          </section>

          {/* Typography Section (Only if not in image mode) */}
          {!imageFile && (
            <section className="space-y-4 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800">
              <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Typography Engine</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase">Font Family</label>
                  <select
                    value={config.fontFamily}
                    onChange={(e) => setConfig({...config, fontFamily: e.target.value})}
                    className="w-full bg-black border border-neutral-800 rounded p-2 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                  >
                    <optgroup label="System/Web Fonts">
                      {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                    </optgroup>
                    {customFonts.length > 0 && (
                      <optgroup label="Uploaded Fonts">
                        {customFonts.map(f => <option key={f} value={f}>{f}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-400 uppercase">Load Custom Font</label>
                  <button 
                    onClick={() => fontInputRef.current?.click()}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-[10px] py-2 rounded border border-neutral-700 border-dashed transition-colors"
                  >
                    + Upload TTF / OTF / WOFF
                  </button>
                  <input 
                    type="file" ref={fontInputRef} onChange={handleFontUpload}
                    accept=".ttf,.otf,.woff,.woff2" className="hidden" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                       <span>Scale</span>
                       <span>{Math.round(config.textScale * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="2.0" step="0.05"
                      value={config.textScale}
                      onChange={(e) => setConfig({...config, textScale: Number(e.target.value)})}
                      className="w-full accent-red-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                       <span>V-Offset</span>
                       <span>{config.vOffset}px</span>
                    </div>
                    <input 
                      type="range" min="-40" max="40" step="1"
                      value={config.vOffset}
                      onChange={(e) => setConfig({...config, vOffset: Number(e.target.value)})}
                      className="w-full accent-neutral-600"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Matrix Specs */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-2">Hardware Specs</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 uppercase">Resolution X</label>
                <input 
                  type="number" 
                  value={config.cols} 
                  onChange={(e) => setConfig({...config, cols: parseInt(e.target.value) || 0})}
                  onBlur={(e) => setConfig({...config, cols: Math.max(8, parseInt(e.target.value) || 8)})}
                  className="w-full bg-black border border-neutral-800 rounded p-2 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 uppercase">Resolution Y</label>
                <input 
                  type="number" 
                  value={config.rows} 
                  onChange={(e) => setConfig({...config, rows: parseInt(e.target.value) || 0})}
                  onBlur={(e) => setConfig({...config, rows: Math.max(8, parseInt(e.target.value) || 8)})}
                  className="w-full bg-black border border-neutral-800 rounded p-2 text-xs font-mono"
                />
              </div>
            </div>
          </section>

          {/* Visuals Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800 pb-2">Visuals</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 uppercase">LED Color</label>
                <input 
                  type="color" value={config.color}
                  onChange={(e) => setConfig({...config, color: e.target.value})}
                  className="w-full h-8 bg-black border border-neutral-800 rounded p-1 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 uppercase">Brightness</label>
                <input 
                  type="range" min="0" max="100" step="1"
                  value={config.brightness}
                  onChange={(e) => setConfig({...config, brightness: Number(e.target.value)})}
                  className="w-full accent-neutral-600"
                />
              </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-[10px] text-neutral-400 uppercase">Effect Speed</label>
                <input 
                  type="range" min="1" max="50" step="1"
                  value={config.speed}
                  onChange={(e) => setConfig({...config, speed: Number(e.target.value)})}
                  className="w-full accent-neutral-600"
                />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-neutral-400 uppercase">Shape & Effect</label>
              <div className="flex gap-2">
                <select
                  value={config.shape}
                  onChange={(e) => setConfig({ ...config, shape: e.target.value as DotShape })}
                  className="flex-1 bg-black border border-neutral-800 rounded p-2 text-[11px] font-mono outline-none"
                >
                  <option value={DotShape.CIRCLE}>Circles</option>
                  <option value={DotShape.SQUARE}>Squares</option>
                  <option value={DotShape.DIAMOND}>Diamonds</option>
                  <option value={DotShape.TRIANGLE}>Triangles</option>
                </select>
                <select
                  value={config.effect}
                  onChange={(e) => setConfig({ ...config, effect: e.target.value as AnimationEffect })}
                  className="flex-1 bg-black border border-neutral-800 rounded p-2 text-[11px] font-mono outline-none"
                >
                  <option value={AnimationEffect.STATIC}>Static</option>
                  <option value={AnimationEffect.SCROLL_LEFT}>Scroll L</option>
                  <option value={AnimationEffect.SCROLL_RIGHT}>Scroll R</option>
                  <option value={AnimationEffect.PULSE}>Pulse</option>
                  <option value={AnimationEffect.SCANLINE}>Scanline</option>
                  <option value={AnimationEffect.WAVE}>Wave</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default App;
