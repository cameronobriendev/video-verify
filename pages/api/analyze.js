import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ANALYSIS_PROMPT = `You are an expert video forensics analyst specializing in deepfake detection. Your job is to be SKEPTICAL and look for ANY signs of manipulation.

IMPORTANT: Assume the video MAY be manipulated until proven otherwise. Modern deepfakes are sophisticated - look carefully.

You are receiving ~15 CONSECUTIVE frames from a random segment of the video (~2 seconds). This allows you to detect TEMPORAL artifacts that only appear in consecutive frames.

ANALYZE EACH SEGMENT FOR:

1. TEMPORAL ARTIFACTS (CRITICAL - look at consecutive frames):
   - Face position/angle that jumps or jitters unnaturally between frames
   - Facial features that "swim," warp, or shift slightly frame-to-frame
   - Skin tone or lighting that flickers between consecutive frames
   - Blinking that looks unnatural (too regular, incomplete, or mechanical)
   - Micro-expressions that don't flow naturally
   - Mouth movements that seem disconnected from natural speech patterns
   - Hair or clothing edges that shimmer or warp unnaturally

2. FACIAL ARTIFACTS:
   - Face boundary blending issues (jawline, hairline, ears)
   - Skin texture inconsistencies (too smooth, plastic-looking)
   - Unnatural eye reflections or catchlights
   - Teeth that look blurry, merged, or unnaturally uniform
   - "Uncanny valley" appearance

3. BOUNDARY ARTIFACTS:
   - Blurring specifically around face edges
   - Color bleeding between face and background
   - Hair that looks painted on or doesn't move naturally
   - Neck/shoulder area that doesn't match the face

4. LIGHTING/SHADOW ISSUES:
   - Face lighting that doesn't match the scene
   - Shadows inconsistent with environment

Provide:
- Specific frames where issues appear (by frame number)
- Exactly what you observe
- Confidence level (low/medium/high) that it indicates manipulation
- Overall verdict: LIKELY AUTHENTIC, POSSIBLY MANIPULATED, or LIKELY MANIPULATED

CRITICAL: Pay special attention to frame-to-frame changes within each segment. Deepfakes often show subtle "swimming" or "warping" effects that only appear when viewing consecutive frames.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { frames } = req.body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: 'No frames provided' });
    }

    // Build the messages array with all frames
    const imageContent = frames.map((frame, index) => ({
      type: 'image_url',
      image_url: {
        url: frame.data,
        detail: 'high'
      }
    }));

    // Add frame context with segment info
    const frameContext = frames.map((frame, index) => {
      const segmentInfo = frame.segment ? `Segment ${frame.segment}, ` : '';
      return `Frame ${index + 1}: ${segmentInfo}timestamp ${frame.timestamp.toFixed(2)}s`;
    }).join('\n');

    // Group frames by segment for context
    const segmentSummary = frames.reduce((acc, frame) => {
      if (frame.segment) {
        if (!acc[frame.segment]) acc[frame.segment] = { start: frame.timestamp, end: frame.timestamp, count: 0 };
        acc[frame.segment].end = frame.timestamp;
        acc[frame.segment].count++;
      }
      return acc;
    }, {});

    const segmentInfo = Object.entries(segmentSummary)
      .map(([seg, data]) => `Segment ${seg}: ${data.count} frames from ${data.start.toFixed(2)}s to ${data.end.toFixed(2)}s`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: ANALYSIS_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze these ${frames.length} consecutive frames extracted from a video for deepfake/manipulation detection.

SEGMENT: ${segmentInfo || 'Single segment'}

FRAME TIMESTAMPS:
${frameContext}

These frames are CONSECUTIVE (about 0.13 seconds apart). Look for frame-to-frame changes that indicate manipulation - swimming, warping, flickering, or unnatural movements.`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 4000
    });

    const analysis = response.choices[0].message.content;

    return res.status(200).json({
      success: true,
      analysis,
      framesAnalyzed: frames.length
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};
