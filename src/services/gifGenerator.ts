import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function createGifFromFrames(
  frames: ImageData[],
  fps: number = 10
): Promise<{ blobUrl: string; base64: string }> {
  if (!frames || frames.length === 0) {
    throw new Error('No frames provided for GIF generation');
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const delay = Math.round(1000 / fps); // 100ms per frame for smooth 10fps turntable

  const gif = GIFEncoder();

  for (const frame of frames) {
    const { data } = frame;
    // High-quality palette quantization
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay,
      repeat: 0 // loop indefinitely
    });
  }

  gif.finish();
  const bytes = gif.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });
  const blobUrl = URL.createObjectURL(blob);

  // Convert to base64 for disk saving
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return { blobUrl, base64 };
}
