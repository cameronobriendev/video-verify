# Video Verify

AI-powered video authenticity checker for deepfake detection.

## Features

- **Video Upload**: Drag-and-drop or click to upload video files (MP4, MOV, WebM)
- **Frame Extraction**: Client-side extraction of key frames for analysis
- **AI Analysis**: GPT-4 Vision analyzes frames for manipulation indicators
- **Risk Assessment**: Clear LOW / MEDIUM / HIGH risk levels
- **Detailed Signals**: Specific findings organized by category
- **Report Download**: Export analysis results

## How It Works

1. Upload a video file
2. System extracts 6 key frames across the video timeline
3. Frames are sent to GPT-4 Vision for forensic analysis
4. AI looks for deepfake indicators:
   - Facial inconsistencies
   - Lighting/shadow mismatches
   - Edge blending artifacts
   - Temporal inconsistencies
5. Results displayed with risk level and detected signals
6. Download report for documentation

## Tech Stack

- **Frontend**: Next.js 16, React 19
- **AI**: OpenAI GPT-4 Vision
- **Hosting**: Vercel
- **Frame Extraction**: Client-side canvas API

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

## Use Cases

- News organizations verifying user-submitted content
- HR departments screening video applications
- Legal teams authenticating video evidence
- Social media platforms flagging synthetic content
- Insurance companies validating video claims

## Limitations

- Analysis quality depends on video resolution
- Works best with videos containing faces
- Not a definitive forensic tool (use for screening)
- Currently supports uploaded files only (YouTube URL support planned)

## License

MIT
