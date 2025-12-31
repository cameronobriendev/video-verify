/**
 * Risk level mapping and signal detection
 * Maps GPT-4 Vision analysis to structured risk assessment
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
  FACIAL: 'Facial Analysis',
  AUDIO: 'Audio Sync',
  VISUAL: 'Visual Artifacts',
  TEMPORAL: 'Temporal Consistency',
  METADATA: 'Technical Analysis'
};

/**
 * Parse GPT-4 Vision response into structured risk assessment
 * Uses GPT-4's explicit verdict instead of naive keyword matching
 */
export function parseAnalysisResponse(gptResponse) {
  const response = gptResponse.toUpperCase();

  // Look for explicit verdict from GPT-4
  let riskLevel;

  if (response.includes('LIKELY AUTHENTIC')) {
    riskLevel = 'LOW';
  } else if (response.includes('LIKELY MANIPULATED')) {
    riskLevel = 'HIGH';
  } else if (response.includes('POSSIBLY MANIPULATED')) {
    riskLevel = 'MEDIUM';
  } else {
    // Fallback: check for clear indicators
    if (response.includes('NO SIGNS OF MANIPULATION') ||
        response.includes('APPEARS AUTHENTIC') ||
        response.includes('LOW SIGNS OF MANIPULATION')) {
      riskLevel = 'LOW';
    } else if (response.includes('HIGH CONFIDENCE') && response.includes('MANIPULAT')) {
      riskLevel = 'HIGH';
    } else {
      riskLevel = 'MEDIUM'; // Default to medium if unclear
    }
  }

  return {
    riskLevel,
    riskInfo: RISK_LEVELS[riskLevel],
    rawAnalysis: gptResponse
  };
}

/**
 * Extract detected signals from analysis
 * Simplified: returns single signal based on verdict to avoid false positives from keyword matching
 */
export function extractSignals(gptResponse, riskLevel) {
  const response = gptResponse.toUpperCase();

  // Return single clear signal based on verdict
  if (response.includes('LIKELY AUTHENTIC') || riskLevel === 'LOW') {
    return [{
      category: SIGNAL_CATEGORIES.VISUAL,
      signal: 'No significant manipulation indicators detected',
      severity: 'low'
    }];
  }

  if (response.includes('LIKELY MANIPULATED') || riskLevel === 'HIGH') {
    return [{
      category: SIGNAL_CATEGORIES.VISUAL,
      signal: 'Multiple manipulation indicators detected',
      severity: 'high'
    }];
  }

  // MEDIUM / POSSIBLY MANIPULATED
  return [{
    category: SIGNAL_CATEGORIES.VISUAL,
    signal: 'Some potential indicators detected - review recommended',
    severity: 'medium'
  }];
}

/**
 * Calculate confidence score (0-100)
 */
export function calculateConfidence(signals, frameCount) {
  // Base confidence from frame count (more frames = higher confidence)
  let confidence = Math.min(50 + (frameCount * 5), 70);

  // Adjust based on signal clarity
  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const lowSeverityCount = signals.filter(s => s.severity === 'low').length;

  // Clear signals (either way) increase confidence
  confidence += (highSeverityCount + lowSeverityCount) * 5;

  // Medium severity signals indicate uncertainty
  const mediumSeverityCount = signals.filter(s => s.severity === 'medium').length;
  confidence -= mediumSeverityCount * 3;

  return Math.max(30, Math.min(95, confidence));
}
