/**
 * Client-side video frame extraction using canvas
 * Extracts frames at regular intervals from a video file
 */

export async function extractFrames(videoFile, frameCount = 6) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const frames = [];
    let currentFrame = 0;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const interval = duration / (frameCount + 1);

      canvas.width = Math.min(video.videoWidth, 1280);
      canvas.height = Math.min(video.videoHeight, 720);

      // Scale to fit
      const scale = Math.min(
        canvas.width / video.videoWidth,
        canvas.height / video.videoHeight
      );
      const scaledWidth = video.videoWidth * scale;
      const scaledHeight = video.videoHeight * scale;

      const captureFrame = () => {
        if (currentFrame >= frameCount) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }

        const timestamp = interval * (currentFrame + 1);
        video.currentTime = timestamp;
      };

      video.onseeked = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          video,
          (canvas.width - scaledWidth) / 2,
          (canvas.height - scaledHeight) / 2,
          scaledWidth,
          scaledHeight
        );

        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        frames.push({
          timestamp: video.currentTime,
          data: frameData,
          index: currentFrame
        });

        currentFrame++;
        captureFrame();
      };

      captureFrame();
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video file'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Convert base64 data URL to base64 string (without prefix)
 */
export function dataUrlToBase64(dataUrl) {
  return dataUrl.split(',')[1];
}
