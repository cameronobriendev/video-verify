# Video Verify

AI-powered video authenticity checker for deepfake detection using GPT-4 Vision.

## Features

- **Video Upload**: Drag-and-drop or click to upload video files (MP4, MOV, WebM)
- **Multi-Segment Sampling**: Analyzes 24 frames across 3 segments (25%, 50%, 75% of video)
- **Structured Scoring**: Per-region analysis with 0-10 scores (mouth, eyes, boundary, temporal)
- **Degree of Risk**: Clear 0-10 risk score with color-coded visualization
- **Demo Mode**: Test with pre-loaded Morgan Freeman deepfake video
- **Report Download**: Export detailed analysis results

## How It Works

1. Upload a video file (or click "Test with Morgan Freeman Deepfake")
2. System extracts 24 frames across 3 video segments (8 frames each at 25%, 50%, 75%)
3. Frames are sent to GPT-4 Vision with structured scoring prompt
4. AI analyzes each region and returns 0-10 scores:
   - **Mouth**: Teeth clarity, lip texture, movement naturalness
   - **Eyes**: Reflection matching, pupil consistency, blink patterns
   - **Face Boundary**: Color matching, jawline blending, hairline artifacts
   - **Temporal**: Frame-to-frame consistency, flickering, warping
5. Results displayed with per-region scores and overall Degree of Risk
6. Download report for documentation

## Tech Stack

- **Frontend**: Next.js 16, React 19
- **AI**: OpenAI GPT-4 Vision with JSON response format
- **Hosting**: Vercel
- **Frame Extraction**: Client-side Canvas API
- **Video Processing**: Multi-segment temporal sampling

## Local Development

```bash
# Install dependencies
npm install

# Set environment variable
echo "OPENAI_API_KEY=your-key-here" > .env.local

# Run development server
npm run dev
```

## Deployment

Deploys automatically to Vercel on push.

Live demo: https://video-verify.cameronobrien.dev

## Detection Accuracy

Based on research, GPT-4 Vision achieves 77-79% AUC for deepfake detection among vision-language models. The structured scoring approach with per-region analysis improves reliability by forcing numerical commitments rather than hedged prose responses.

## Limitations

- Analysis quality depends on video resolution
- Works best with videos containing faces
- Not a definitive forensic tool (use for screening)
- VLM-based detection has inherent accuracy limits vs specialized CNN models

## License

MIT
