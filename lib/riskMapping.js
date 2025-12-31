/**
 * Risk level mapping and signal detection
 * Handles both structured JSON responses and legacy free-text responses
 */

export const RISK_LEVELS = {
  LOW: {
    label: 'LOW RISK',
    color: '#22c55e',
    bgColor: '#dcfce7',
    description: 'Video appears authentic with no significant manipulation indicators detected.'
  },
  MEDIUM: {
    label: 'MEDIUM RISK',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    description: 'Some potential indicators detected. Manual review recommended.'
  },
  HIGH: {
    label: 'HIGH RISK',
    color: '#ef4444',
    bgColor: '#fee2e2',
    description: 'Multiple manipulation indicators detected. Video authenticity is questionable.'
  }
};

export const SIGNAL_CATEGORIES = {
  MOUTH: 'Mouth Analysis',
  EYES: 'Eye Analysis',
  BOUNDARY: 'Face Boundary',
  TEMPORAL: 'Temporal Consistency'
};

/**
 * Parse analysis response - handles both structured JSON and legacy formats
 */
export function parseAnalysisResponse(result) {
  // Handle structured response (new format)
  if (result.structured && result.scores) {
    return parseStructuredResponse(result);
  }

  // Handle legacy free-text response
  if (result.analysis && typeof result.analysis === 'string') {
    return parseLegacyResponse(result.analysis);
  }

  // Fallback for unexpected format
  return {
    riskLevel: 'MEDIUM',
    riskInfo: RISK_LEVELS.MEDIUM,
    scores: null,
    rawAnalysis: JSON.stringify(result)
  };
}

/**
 * Parse structured JSON response with scores
 */
function parseStructuredResponse(result) {
  const { scores, verdict, keyEvidence, analysis } = result;
  const avgScore = scores.average;

  let riskLevel;

  // Determine risk level based on average score and verdict
  if (avgScore >= 6 || verdict === 'MANIPULATED') {
    riskLevel = 'HIGH';
  } else if (avgScore >= 4 || verdict === 'SUSPICIOUS') {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    riskLevel,
    riskInfo: RISK_LEVELS[riskLevel],
    scores,
    verdict,
    keyEvidence,
    rawAnalysis: analysis
  };
}

/**
 * Parse legacy free-text response (fallback)
 */
function parseLegacyResponse(gptResponse) {
  const response = gptResponse.toUpperCase();

  let riskLevel;

  if (response.includes('LIKELY AUTHENTIC') || response.includes('AUTHENTIC')) {
    riskLevel = 'LOW';
  } else if (response.includes('LIKELY MANIPULATED') || response.includes('MANIPULATED')) {
    riskLevel = 'HIGH';
  } else if (response.includes('POSSIBLY MANIPULATED') || response.includes('SUSPICIOUS')) {
    riskLevel = 'MEDIUM';
  } else {
    // Fallback checks
    if (response.includes('NO SIGNS OF MANIPULATION') ||
        response.includes('APPEARS AUTHENTIC')) {
      riskLevel = 'LOW';
    } else if (response.includes('HIGH CONFIDENCE') && response.includes('MANIPULAT')) {
      riskLevel = 'HIGH';
    } else {
      riskLevel = 'MEDIUM';
    }
  }

  return {
    riskLevel,
    riskInfo: RISK_LEVELS[riskLevel],
    scores: null,
    rawAnalysis: gptResponse
  };
}

/**
 * Extract detected signals from analysis
 */
export function extractSignals(result) {
  const signals = [];

  // Handle structured response with scores
  if (result.scores) {
    const { scores, keyEvidence } = result;

    // Add signals for each region based on score
    if (scores.mouth !== undefined) {
      signals.push({
        category: SIGNAL_CATEGORIES.MOUTH,
        signal: getScoreDescription('mouth', scores.mouth),
        severity: getScoreSeverity(scores.mouth),
        score: scores.mouth
      });
    }

    if (scores.eyes !== undefined) {
      signals.push({
        category: SIGNAL_CATEGORIES.EYES,
        signal: getScoreDescription('eyes', scores.eyes),
        severity: getScoreSeverity(scores.eyes),
        score: scores.eyes
      });
    }

    if (scores.boundary !== undefined) {
      signals.push({
        category: SIGNAL_CATEGORIES.BOUNDARY,
        signal: getScoreDescription('boundary', scores.boundary),
        severity: getScoreSeverity(scores.boundary),
        score: scores.boundary
      });
    }

    if (scores.temporal !== undefined) {
      signals.push({
        category: SIGNAL_CATEGORIES.TEMPORAL,
        signal: getScoreDescription('temporal', scores.temporal),
        severity: getScoreSeverity(scores.temporal),
        score: scores.temporal
      });
    }

    // Add key evidence as a signal if present
    if (keyEvidence) {
      signals.unshift({
        category: 'Key Finding',
        signal: keyEvidence,
        severity: result.riskLevel === 'HIGH' ? 'high' : result.riskLevel === 'MEDIUM' ? 'medium' : 'low'
      });
    }

    return signals;
  }

  // Legacy fallback: single signal based on verdict
  const riskLevel = result.riskLevel || 'MEDIUM';

  if (riskLevel === 'LOW') {
    return [{
      category: 'Overall Analysis',
      signal: 'No significant manipulation indicators detected',
      severity: 'low'
    }];
  }

  if (riskLevel === 'HIGH') {
    return [{
      category: 'Overall Analysis',
      signal: 'Multiple manipulation indicators detected',
      severity: 'high'
    }];
  }

  return [{
    category: 'Overall Analysis',
    signal: 'Some potential indicators detected - review recommended',
    severity: 'medium'
  }];
}

/**
 * Get description for a score
 */
function getScoreDescription(region, score) {
  const descriptions = {
    mouth: {
      low: 'Natural lip and teeth appearance',
      medium: 'Minor irregularities in mouth region',
      high: 'Significant mouth artifacts detected'
    },
    eyes: {
      low: 'Natural eye reflections and movement',
      medium: 'Slight inconsistencies in eye region',
      high: 'Eye region shows manipulation signs'
    },
    boundary: {
      low: 'Clean face-to-background transition',
      medium: 'Minor boundary irregularities',
      high: 'Visible blending artifacts at face boundary'
    },
    temporal: {
      low: 'Consistent frame-to-frame motion',
      medium: 'Some temporal inconsistencies',
      high: 'Significant temporal artifacts detected'
    }
  };

  const level = score < 4 ? 'low' : score < 7 ? 'medium' : 'high';
  return descriptions[region]?.[level] || `Score: ${score}/10`;
}

/**
 * Get severity from score
 */
function getScoreSeverity(score) {
  if (score < 4) return 'low';
  if (score < 7) return 'medium';
  return 'high';
}

/**
 * Calculate confidence score (0-100)
 */
export function calculateConfidence(signals, frameCount, scores) {
  // If we have structured scores, use them for confidence
  if (scores) {
    // Higher average score = more confident in detection
    // More frames analyzed = more confident
    const avgScore = scores.average || 5;
    const scoreConfidence = Math.min(95, 50 + avgScore * 5);
    const frameBonus = Math.min(20, frameCount * 0.8);

    // If scores are extreme (very low or very high), confidence is higher
    const scoreVariance = Math.abs(avgScore - 5);
    const certaintyBonus = scoreVariance * 3;

    return Math.min(95, Math.max(30, scoreConfidence + frameBonus + certaintyBonus));
  }

  // Legacy calculation
  let confidence = Math.min(50 + (frameCount * 3), 70);

  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const lowSeverityCount = signals.filter(s => s.severity === 'low').length;

  confidence += (highSeverityCount + lowSeverityCount) * 5;

  const mediumSeverityCount = signals.filter(s => s.severity === 'medium').length;
  confidence -= mediumSeverityCount * 3;

  return Math.max(30, Math.min(95, Math.round(confidence)));
}
