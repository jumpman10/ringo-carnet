/**
 * Image processing utilities for Ringo Gym member carnet photos.
 * Ensures 1:1 square aspect ratio and lightweight compression (<40KB).
 */

export interface CarnetPhotoOptions {
  size?: number; // Target square dimension in pixels (default: 400)
  quality?: number; // JPEG quality from 0 to 1 (default: 0.82)
}

/**
 * Reads a File or Blob as an HTMLImageElement
 */
function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('No se pudo cargar la imagen seleccionada.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Takes an image source (HTMLVideoElement, HTMLImageElement, File, or Blob),
 * performs a 1:1 center-crop, resizes it to target size, and returns a compressed JPEG data URL.
 */
export async function processCarnetPhoto(
  source: HTMLVideoElement | HTMLImageElement | File | Blob,
  options: CarnetPhotoOptions = {}
): Promise<string> {
  const { size = 400, quality = 0.82 } = options;

  let imageElement: CanvasImageSource;
  let sourceWidth = 0;
  let sourceHeight = 0;

  if (source instanceof HTMLVideoElement) {
    imageElement = source;
    sourceWidth = source.videoWidth;
    sourceHeight = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    imageElement = source;
    sourceWidth = source.naturalWidth || source.width;
    sourceHeight = source.naturalHeight || source.height;
  } else {
    // File or Blob
    const img = await loadImageFromFile(source);
    imageElement = img;
    sourceWidth = img.naturalWidth || img.width;
    sourceHeight = img.naturalHeight || img.height;
  }

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Dimensiones de imagen no válidas.');
  }

  // Calculate center square crop (1:1 aspect ratio)
  const minDim = Math.min(sourceWidth, sourceHeight);
  const sx = (sourceWidth - minDim) / 2;
  const sy = (sourceHeight - minDim) / 2;

  // Render onto 1:1 canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo para procesar la imagen.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw 1:1 cropped square
  ctx.drawImage(
    imageElement,
    sx,
    sy,
    minDim,
    minDim,
    0,
    0,
    size,
    size
  );

  // Export as lightweight JPEG
  return canvas.toDataURL('image/jpeg', quality);
}
