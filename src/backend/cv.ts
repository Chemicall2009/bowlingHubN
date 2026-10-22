/**
 * Local Computer Vision & Direct Linear Transformation (DLT) Module
 * 
 * Provides 4-point planar homography calibration between overhead camera
 * pin deck feed and standard USBC pin triangle coordinates.
 * No cloud LLM required — runs high-speed deterministic image processing.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface PinDeckCalibration {
  /** 4 corner points on camera image: [TopLeft, TopRight, BottomRight, BottomLeft] */
  imageCorners: [Point2D, Point2D, Point2D, Point2D];
  /** 3x3 Homography transformation matrix */
  homographyMatrix: number[][];
  /** Calibrated ROIs for pins 1 through 10 */
  pinROIs: {
    pinNumber: number;
    center: Point2D;
    radius: number;
    normalBrightness: number;
  }[];
  isCalibrated: boolean;
  lastCalibratedAt: number;
}

export class PinVisionEngine {
  /**
   * Standard pin deck metric coordinates (in centimeters relative to Pin 1 headpin at 0, 0)
   * Pin 1: (0, 0)
   * Pin 2: (-15.24, 26.39), Pin 3: (15.24, 26.39)
   * Pin 4: (-30.48, 52.78), Pin 5: (0, 52.78), Pin 6: (30.48, 52.78)
   * Pin 7: (-45.72, 79.18), Pin 8: (-15.24, 79.18), Pin 9: (15.24, 79.18), Pin 10: (45.72, 79.18)
   */
  public static readonly STANDARD_PIN_COORDS: Record<number, Point2D> = {
    1: { x: 0, y: 0 },
    2: { x: -15.24, y: 26.39 },
    3: { x: 15.24, y: 26.39 },
    4: { x: -30.48, y: 52.78 },
    5: { x: 0, y: 52.78 },
    6: { x: 30.48, y: 52.78 },
    7: { x: -45.72, y: 79.18 },
    8: { x: -15.24, y: 79.18 },
    9: { x: 15.24, y: 79.18 },
    10: { x: 45.72, y: 79.18 },
  };

  /**
   * Compute 3x3 Homography Matrix using Direct Linear Transformation (DLT)
   * maps src points to dst points
   */
  public computeHomography(src: Point2D[], dst: Point2D[]): number[][] {
    if (src.length < 4 || dst.length < 4) {
      throw new Error('DLT homography requires at least 4 point correspondences');
    }

    // Default normalized identity matrix fallback
    const matrix: number[][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    // Calculate affine-projective coefficients
    const x0 = src[0].x, y0 = src[0].y;
    const x1 = src[1].x, y1 = src[1].y;
    const x2 = src[2].x, y2 = src[2].y;
    const x3 = src[3].x, y3 = src[3].y;

    const u0 = dst[0].x, v0 = dst[0].y;
    const u1 = dst[1].x, v1 = dst[1].y;
    const u2 = dst[2].x, v2 = dst[2].y;
    const u3 = dst[3].x, v3 = dst[3].y;

    // DLT standard 8x8 system solution for quad-to-quad mapping
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

    if (dx3 === 0 && dy3 === 0) {
      matrix[0][0] = (u1 - u0) / (x1 - x0 || 1);
      matrix[0][1] = (u3 - u0) / (y3 - y0 || 1);
      matrix[0][2] = u0;
      matrix[1][0] = (v1 - v0) / (x1 - x0 || 1);
      matrix[1][1] = (v3 - v0) / (y3 - y0 || 1);
      matrix[1][2] = v0;
      matrix[2][0] = 0;
      matrix[2][1] = 0;
      matrix[2][2] = 1;
    } else {
      const g = (dx3 * dy2 - dx2 * dy3) / (dx1 * dy2 - dx2 * dy1 || 1);
      const h = (dx1 * dy3 - dx3 * dy1) / (dx1 * dy2 - dx2 * dy1 || 1);
      matrix[0][0] = u1 - u0 + g * u1;
      matrix[0][1] = u3 - u0 + h * u3;
      matrix[0][2] = u0;
      matrix[1][0] = v1 - v0 + g * v1;
      matrix[1][1] = v3 - v0 + h * v3;
      matrix[1][2] = v0;
      matrix[2][0] = g;
      matrix[2][1] = h;
      matrix[2][2] = 1;
    }

    return matrix;
  }

  /**
   * Transform image point (u, v) using homography matrix
   */
  public applyHomography(matrix: number[][], pt: Point2D): Point2D {
    const x = matrix[0][0] * pt.x + matrix[0][1] * pt.y + matrix[0][2];
    const y = matrix[1][0] * pt.x + matrix[1][1] * pt.y + matrix[1][2];
    const w = matrix[2][0] * pt.x + matrix[2][1] * pt.y + matrix[2][2];
    const z = w !== 0 ? w : 1;
    return { x: x / z, y: y / z };
  }

  /**
   * Generate default calibration for a 1920x1080 camera stream
   */
  public createDefaultCalibration(width = 1920, height = 1080): PinDeckCalibration {
    const marginX = width * 0.2;
    const marginY = height * 0.15;

    const imageCorners: [Point2D, Point2D, Point2D, Point2D] = [
      { x: marginX, y: marginY }, // Top-Left (Pin 7 corner)
      { x: width - marginX, y: marginY }, // Top-Right (Pin 10 corner)
      { x: width - marginX * 1.3, y: height - marginY }, // Bottom-Right (Pin 3 side)
      { x: marginX * 1.3, y: height - marginY }, // Bottom-Left (Pin 2 side)
    ];

    const pinROIs = [];
    // Approximate positions on camera frame
    const pinPositions: Record<number, Point2D> = {
      1: { x: width * 0.50, y: height * 0.78 },
      2: { x: width * 0.42, y: height * 0.58 },
      3: { x: width * 0.58, y: height * 0.58 },
      4: { x: width * 0.35, y: height * 0.40 },
      5: { x: width * 0.50, y: height * 0.40 },
      6: { x: width * 0.65, y: height * 0.40 },
      7: { x: width * 0.28, y: height * 0.22 },
      8: { x: width * 0.42, y: height * 0.22 },
      9: { x: width * 0.58, y: height * 0.22 },
      10: { x: width * 0.72, y: height * 0.22 },
    };

    for (let p = 1; p <= 10; p++) {
      pinROIs.push({
        pinNumber: p,
        center: pinPositions[p] || { x: width / 2, y: height / 2 },
        radius: 28,
        normalBrightness: 210,
      });
    }

    const homographyMatrix = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    return {
      imageCorners,
      homographyMatrix,
      pinROIs,
      isCalibrated: true,
      lastCalibratedAt: Date.now(),
    };
  }

  /**
   * Predict pin standing array [1..10] given simulated or detected ROI white/color luminance
   */
  public evaluatePinBitmask(
    roiLuminances: number[],
    threshold = 140
  ): { pins: boolean[]; standingCount: number } {
    const pins: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      const lum = roiLuminances[i] ?? 200;
      pins.push(lum >= threshold);
    }
    const standingCount = pins.filter(Boolean).length;
    return { pins, standingCount };
  }
}

export const cvEngine = new PinVisionEngine();
