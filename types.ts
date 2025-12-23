
export enum DotShape {
  CIRCLE = 'circle',
  SQUARE = 'square',
  DIAMOND = 'diamond',
  TRIANGLE = 'triangle'
}

export enum AnimationEffect {
  STATIC = 'static',
  SCROLL_LEFT = 'scroll-left',
  SCROLL_RIGHT = 'scroll-right',
  PULSE = 'pulse',
  SCANLINE = 'scanline',
  WAVE = 'wave'
}

export interface MatrixConfig {
  rows: number;
  cols: number;
  dotSize: number;
  gap: number;
  color: string;
  offColor: string;
  bgColor: string;
  shape: DotShape;
  brightness: number;
  bloom: number;
  effect: AnimationEffect;
  speed: number;
  // Typography additions
  fontFamily: string;
  textScale: number;
  vOffset: number;
  threshold: number; // For mapping TTF anti-aliasing to 1-bit matrix
}

export interface DisplayData {
  buffer: boolean[][];
  width: number;
  height: number;
}
