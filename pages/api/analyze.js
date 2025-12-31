import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ANALYSIS_PROMPT = `You are an expert video forensics analyst specializing in deepfake detection. Your job is to be SKEPTICAL and look for ANY signs of manipulation.

IMPORTANT: Assume the video MAY be manipulated until proven otherwise. Modern deepfakes are sophisticated - look carefully.

Analyze these frames for manipulation indicators:

1. FACIAL ARTIFACTS (most common in deepfakes):
   - Face boundary blending issues (look at jawline, hairline, ears)
   - Skin texture inconsistencies (too smooth, plastic-looking, or mismatched)
   - Unnatural eye reflections or catchlights that don't match
   - Teeth that look blurry, merged, or unnaturally uniform
   - Asymmetric facial features that shift between frames
   - "Uncanny valley" appearance - face looks slightly off

2. TEMPORAL ARTIFACTS (frame-to-frame):
   - Face position/angle that jumps or jitters unnaturally
   - Skin tone or lighting that flickers between frames
   - Facial features that "swim" or warp slightly
   - Blinking patterns that seem off (too regular, too rare, or unnatural)
   - Expression changes that don't flow naturally

3. BOUNDARY ARTIFACTS:
   - Blurring specifically around face edges
   - Color bleeding between face and background
   - Hair that looks painted on or doesn't move naturally
   - Neck/shoulder area that doesn't match the face

4. LIGHTING/SHADOW ISSUES:
   - Face lighting that doesn't match the scene
   - Shadows on face inconsistent with background shadows
   - Reflections that don't match between face and environment

5. COMPRESSION TELLS:
   - Different compression levels on face vs body/background
   - Blockiness or artifacts specifically around facial region

For each issue found, specify:
- Which frame(s)
- Exactly what you see
- How confident you are it indicates manipulation

CRITICAL: If you see ANYTHING suspicious, flag it. It's better to have false positives than miss a deepfake. Be thorough and skeptical.`;

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
      max_tokens: 3000
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
