import type { ImageOptimizer, SourceFile } from '../../application/ports';
import { AppError } from '../../domain/errors';

async function decode(file: SourceFile): Promise<ImageBitmap> {
  try {
    // createImageBitmap applies the EXIF orientation, so the result is always upright.
    return await createImageBitmap(new Blob([file.bytes as Uint8Array<ArrayBuffer>]), {
      imageOrientation: 'from-image',
    });
  } catch (error) {
    throw new AppError('template-image-damaged', file.name, { cause: error });
  }
}

function canvasFor(bitmap: ImageBitmap): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new AppError('template-image-damaged', 'canvas 2d');
  return { canvas, context };
}

/** Converts heavy images to JPG in the browser (canvas), never uploading anything. */
export const canvasImageOptimizer: ImageOptimizer = {
  async hasTransparency(file) {
    const bitmap = await decode(file);
    try {
      const { context } = canvasFor(bitmap);
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 255) return true;
      }
      return false;
    } finally {
      bitmap.close();
    }
  },

  async toJpeg(file, quality) {
    const bitmap = await decode(file);
    try {
      const { canvas, context } = canvasFor(bitmap);
      // Transparent areas would turn black in a JPG: paint them white.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new AppError('template-image-damaged', 'jpeg export'));
          },
          'image/jpeg',
          quality,
        );
      });
      return {
        name: `${file.name.replace(/\.[^.]+$/u, '')}.jpg`,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mimeType: 'image/jpeg',
      };
    } finally {
      bitmap.close();
    }
  },
};
