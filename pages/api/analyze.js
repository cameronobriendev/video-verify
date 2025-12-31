import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Research-backed structured prompt for deepfake detection
// Forces numerical scoring to prevent hedging, focuses on highest-reliability regions
const DETECTION_PROMPT = `You are a forensic analyst examining video frames for deepfake manipulation.
This content is SUSPECTED to be AI-generated. Your job is to find evidence of manipulation.

Score each region 0-10 where 0=definitely authentic, 10=definitely manipulated:

MOUTH (highest detection reliability):
- Are teeth blurry, merged, or unnaturally uniform?
- Do lip edges look soft, painted, or lack natural texture?
- Does mouth movement appear mechanical or disconnected from speech?
- Any unnatural smoothness around lips?

EYES:
- Do both eyes have matching reflections/catchlights?
- Are pupil shapes consistent and natural?
- Do blinks look complete and natural?
- Any asymmetry in eye positioning or movement?

FACE BOUNDARY:
- Is there color mismatch between face and neck?
- Any blur specifically at the jawline-neck junction?
- Hairline feathering, ghosting, or incomplete blending?
- Does skin texture change abruptly at face edges?

TEMPORAL (frame-to-frame changes):
- Does face texture "swim" or shift independently of head motion?
- Any flickering, sudden jumps, or unnatural transitions?
- Do facial features maintain consistent relative positions?
- Any warping during expressions or movement?

IMPORTANT: Be aggressive in scoring. Modern deepfakes are sophisticated.
If something looks slightly off, score it higher. Err on the side of detection.

Respond with ONLY this JSON (no markdown, no explanation outside JSON):
{
  "mouth_score": <0-10>,
  "eyes_score": <0-10>,
  "boundary_score": <0-10>,
  "temporal_score": <0-10>,
  "verdict": "AUTHENTIC" | "SUSPICIOUS" | "MANIPULATED",
  "key_evidence": "<one sentence describing the most significant finding>",
  "detailed_analysis": "<2-3 sentences explaining your scoring>"
}`;

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
          content: DETECTION_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze these ${frames.length} video frames for deepfake/manipulation detection.

VIDEO SEGMENTS ANALYZED:
${segmentInfo || 'Single segment'}

FRAME TIMESTAMPS:
${frameContext}

These frames are from consecutive sequences (~0.13 seconds apart within each segment).
Focus on frame-to-frame changes for temporal artifacts.
Score each region 0-10 and provide your verdict.`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const analysisText = response.choices[0].message.content;

    // Parse the JSON response
    let analysisData;
    try {
      analysisData = JSON.parse(analysisText);
    } catch (parseError) {
      // If JSON parsing fails, return the raw text for fallback handling
      return res.status(200).json({
        success: true,
        analysis: analysisText,
        structured: false,
        framesAnalyzed: frames.length
      });
    }

    // Calculate average score
    const avgScore = (
      (analysisData.mouth_score || 0) +
      (analysisData.eyes_score || 0) +
      (analysisData.boundary_score || 0) +
      (analysisData.temporal_score || 0)
    ) / 4;

    return res.status(200).json({
      success: true,
      structured: true,
      scores: {
        mouth: analysisData.mouth_score,
        eyes: analysisData.eyes_score,
        boundary: analysisData.boundary_score,
        temporal: analysisData.temporal_score,
        average: Math.round(avgScore * 10) / 10
      },
      verdict: analysisData.verdict,
      keyEvidence: analysisData.key_evidence,
      analysis: analysisData.detailed_analysis,
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
