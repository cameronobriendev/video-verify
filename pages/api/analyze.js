import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ANALYSIS_PROMPT = `You are an expert video forensics analyst specializing in deepfake detection and video authenticity verification.

Analyze these video frames for signs of manipulation, deepfakes, or synthetic generation. Look for:

1. FACIAL ANALYSIS:
   - Unnatural facial movements or expressions
   - Inconsistent skin texture or blending at face boundaries
   - Eye movement anomalies (blinking patterns, gaze direction)
   - Lip sync issues or unnatural mouth movements

2. VISUAL ARTIFACTS:
   - Blurring or warping around face edges
   - Inconsistent lighting or shadows on face vs background
   - Compression artifacts that differ between face and body
   - Unnatural hair boundaries or movement

3. TEMPORAL CONSISTENCY:
   - Frame-to-frame inconsistencies in face position/angle
   - Flickering or jittering in facial features
   - Unnatural transitions between expressions

4. BACKGROUND ANALYSIS:
   - Background consistency across frames
   - Edge artifacts where subject meets background

Provide a detailed analysis covering:
- What you observe in each frame
- Any suspicious indicators found
- Overall assessment of authenticity
- Confidence level in your assessment

Be specific about which frames show issues and what exactly you detected.`;

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

    // Add frame timestamp context
    const frameContext = frames.map((frame, index) =>
      `Frame ${index + 1}: timestamp ${frame.timestamp.toFixed(2)}s`
    ).join('\n');

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
              text: `Analyze these ${frames.length} frames extracted from a video for deepfake/manipulation detection:\n\n${frameContext}\n\nProvide your detailed forensic analysis.`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 2000
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
