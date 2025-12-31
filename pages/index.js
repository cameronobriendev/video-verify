import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { DEMO_FRAMES, DEMO_VIDEO_INFO } from '../lib/demoFrames';

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ stage: '', percent: 0 });
  const [error, setError] = useState(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
    } else {
      setError('Please upload a valid video file');
    }
  }, []);

  const handleFileSelect = (e) => {
    setError(null);
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
    } else {
      setError('Please upload a valid video file');
    }
  };

  // Multi-segment temporal sampling:
  // 3 segments at 25%, 50%, 75% of video duration
  // 8 consecutive frames per segment = 24 total frames
  const extractFrames = async (videoFile) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const allFrames = [];
      const segments = 3; // Sample from 3 different parts of video
      const framesPerSegment = 8; // 8 consecutive frames each
      const segmentDuration = 1; // ~1 second per segment
      const frameInterval = segmentDuration / framesPerSegment; // ~0.125s between frames

      let segmentTimestamps = [];
      let currentSegment = 0;
      let currentFrameInSegment = 0;

      video.onloadedmetadata = () => {
        const duration = video.duration;

        // Sample at 25%, 50%, 75% of video duration
        // Avoid first/last 10% of video
        const safeStart = duration * 0.1;
        const safeEnd = duration * 0.9;

        if (duration < 3) {
          // Very short video: sample evenly
          segmentTimestamps = [
            safeStart,
            duration * 0.5,
            safeEnd - segmentDuration
          ];
        } else {
          // Normal video: sample at 25%, 50%, 75%
          segmentTimestamps = [
            duration * 0.25,
            duration * 0.50,
            duration * 0.75
          ];
        }

        // Ensure segments don't exceed video duration
        segmentTimestamps = segmentTimestamps.map(t =>
          Math.min(t, duration - segmentDuration)
        );

        canvas.width = Math.min(video.videoWidth, 1280);
        canvas.height = Math.min(video.videoHeight, 720);

        const scale = Math.min(
          canvas.width / video.videoWidth,
          canvas.height / video.videoHeight
        );
        const scaledWidth = video.videoWidth * scale;
        const scaledHeight = video.videoHeight * scale;

        const captureFrame = () => {
          if (currentSegment >= segments) {
            URL.revokeObjectURL(video.src);
            resolve(allFrames);
            return;
          }

          const baseTime = segmentTimestamps[currentSegment];
          const timestamp = baseTime + (currentFrameInSegment * frameInterval);
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
          allFrames.push({
            timestamp: video.currentTime,
            data: frameData,
            segment: currentSegment + 1,
            frameInSegment: currentFrameInSegment + 1
          });

          const totalFrames = segments * framesPerSegment;
          const completedFrames = (currentSegment * framesPerSegment) + currentFrameInSegment + 1;
          setProgress({
            stage: `Extracting segment ${currentSegment + 1}/${segments}`,
            percent: Math.round((completedFrames / totalFrames) * 30)
          });

          currentFrameInSegment++;
          if (currentFrameInSegment >= framesPerSegment) {
            currentSegment++;
            currentFrameInSegment = 0;
          }
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
  };

  const analyzeFrames = async (frames, fileInfo) => {
    setLoading(true);
    setError(null);

    try {
      // Send to API
      setProgress({ stage: 'Analyzing with AI', percent: 40 });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames })
      });

      setProgress({ stage: 'Processing results', percent: 80 });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }

      const result = await response.json();

      setProgress({ stage: 'Complete', percent: 100 });

      // Store results and navigate
      sessionStorage.setItem('analysisResult', JSON.stringify({
        ...result,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        frames: frames.map(f => ({ timestamp: f.timestamp, data: f.data, segment: f.segment })),
        analyzedAt: new Date().toISOString()
      }));

      router.push('/results');

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze video');
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Extract frames
      setProgress({ stage: 'Extracting frames', percent: 5 });
      const frames = await extractFrames(file);

      // Step 2: Analyze
      await analyzeFrames(frames, { fileName: file.name, fileSize: file.size });

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze video');
      setLoading(false);
    }
  };

  const handleDemoAnalyze = async () => {
    setLoading(true);
    setError(null);
    setProgress({ stage: 'Loading demo video', percent: 10 });

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    setProgress({ stage: 'Frames ready', percent: 30 });

    // Use pre-extracted demo frames
    await analyzeFrames(DEMO_FRAMES, DEMO_VIDEO_INFO);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Head>
        <title>Video Verify - AI Authenticity Checker</title>
        <meta name="description" content="Detect deepfakes and verify video authenticity with AI-powered analysis" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation */}
      <nav className="nav-bar">
        <a href="https://cameronobrien.dev" className="nav-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Portfolio
        </a>
        <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>
          Built by cameronobrien.dev
        </div>
      </nav>

      <div className="container">
        <header className="header">
          <h1>Video Verify</h1>
          <p>AI-powered deepfake detection and authenticity analysis</p>
        </header>

        <div
          className={`upload-area ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>

          {file ? (
            <>
              <h3>Video Selected</h3>
              <div className="file-info">
                <div className="name">{file.name}</div>
                <div className="size">{formatFileSize(file.size)}</div>
              </div>
            </>
          ) : (
            <>
              <h3>Drop your video here</h3>
              <p>or click to browse. Supports MP4, MOV, WebM, and more.</p>
            </>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleAnalyze}
          disabled={!file || loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Video'}
        </button>

        {/* Demo Section */}
        <div className="demo-divider">or try a demo</div>

        <button
          className="btn btn-demo btn-full"
          onClick={handleDemoAnalyze}
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Test with Morgan Freeman Deepfake
        </button>

        {loading && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="progress-text">
              <span>{progress.stage}</span>
              <span>{progress.percent}%</span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-text">{progress.stage}...</div>
        </div>
      )}
    </>
  );
}
