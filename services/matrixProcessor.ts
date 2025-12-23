
import { MatrixConfig } from '../types';

/**
 * Processes text and images into bitmasks for the LED matrix
 */
export class MatrixProcessor {
  private static canvas: HTMLCanvasElement = document.createElement('canvas');
  private static ctx = MatrixProcessor.canvas.getContext('2d', { willReadFrequently: true });

  static async textToMatrix(text: string, config: MatrixConfig): Promise<boolean[][]> {
    const { rows, cols, fontFamily, textScale, vOffset, threshold } = config;
    if (!this.ctx) return [];
    
    // Calculate effective font size
    const fontSize = Math.floor(rows * textScale);
    
    // Set font to measure
    this.ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
    
    // Auto-calculate width based on text
    const metrics = this.ctx.measureText(text);
    const textWidth = Math.ceil(metrics.width);
    const targetWidth = Math.max(cols, textWidth + 20);

    this.canvas.width = targetWidth;
    this.canvas.height = rows;
    
    // Ensure crisp rendering for mapping
    this.ctx.imageSmoothingEnabled = false;
    
    // Clear and draw text
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, targetWidth, rows);
    
    this.ctx.fillStyle = 'white';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'left';
    this.ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
    
    // Center vertically with user offset
    const yPos = (rows / 2) + vOffset;
    this.ctx.fillText(text, 10, yPos);

    const imgData = this.ctx.getImageData(0, 0, targetWidth, rows).data;
    const matrix: boolean[][] = [];

    for (let y = 0; y < rows; y++) {
      matrix[y] = [];
      for (let x = 0; x < targetWidth; x++) {
        const i = (y * targetWidth + x) * 4;
        const gray = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
        const alpha = imgData[i + 3];
        const intensity = (gray * (alpha / 255));
        
        matrix[y][x] = intensity >= threshold; 
      }
    }

    return matrix;
  }

  static async imageToMatrix(file: File, rows: number, cols: number, threshold: number = 128): Promise<boolean[][]> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (!this.ctx) return resolve([]);
          
          const ratio = img.width / img.height;
          // For SVG, we want to respect the aspect ratio while fitting the rows
          const targetWidth = Math.round(rows * ratio);
          
          this.canvas.width = targetWidth;
          this.canvas.height = rows;
          this.ctx.imageSmoothingEnabled = false;
          
          // Clear background to black first to avoid transparency issues
          this.ctx.fillStyle = 'black';
          this.ctx.fillRect(0, 0, targetWidth, rows);

          this.ctx.drawImage(img, 0, 0, targetWidth, rows);
          const imgData = this.ctx.getImageData(0, 0, targetWidth, rows).data;
          
          const matrix: boolean[][] = [];
          for (let y = 0; y < rows; y++) {
            matrix[y] = [];
            for (let x = 0; x < targetWidth; x++) {
              const i = (y * targetWidth + x) * 4;
              // Simple grayscale average for standard images/SVGs
              const brightness = (imgData[i] + imgData[i+1] + imgData[i+2]) / 3;
              matrix[y][x] = brightness >= threshold;
            }
          }
          resolve(matrix);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }
}
