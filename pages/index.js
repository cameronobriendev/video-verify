import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

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

  const extractFrames = async (videoFile, frameCount = 6) => {
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

          setProgress({
            stage: 'Extracting frames',
            percent: Math.round(((currentFrame + 1) / frameCount) * 30)
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
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Extract frames
      setProgress({ stage: 'Extracting frames', percent: 5 });
      const frames = await extractFrames(file, 12);

      // Step 2: Send to API
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
        fileName: file.name,
        fileSize: file.size,
        frames: frames.map(f => ({ timestamp: f.timestamp, data: f.data })),
        analyzedAt: new Date().toISOString()
      }));

      router.push('/results');

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze video');
      setLoading(false);
    }
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
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            color: '#ef4444'
          }}>
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
