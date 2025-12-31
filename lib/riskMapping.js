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
 */
export function parseAnalysisResponse(gptResponse) {
  const response = gptResponse.toLowerCase();

  // Count risk indicators
  const highRiskKeywords = [
    'deepfake', 'manipulated', 'synthetic', 'generated', 'fake',
    'inconsistent lighting', 'unnatural movement', 'artifacts',
    'blending artifacts', 'warping', 'morphing', 'ai-generated'
  ];

  const mediumRiskKeywords = [
    'possible', 'potential', 'might be', 'could be', 'uncertain',
    'slight inconsistency', 'minor artifact', 'unusual', 'questionable'
  ];

  const lowRiskKeywords = [
    'authentic', 'genuine', 'natural', 'consistent', 'no signs',
    'appears real', 'no manipulation', 'no artifacts detected'
  ];

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  highRiskKeywords.forEach(kw => {
    if (response.includes(kw)) highCount++;
  });

  mediumRiskKeywords.forEach(kw => {
    if (response.includes(kw)) mediumCount++;
  });

  lowRiskKeywords.forEach(kw => {
    if (response.includes(kw)) lowCount++;
  });

  // Determine overall risk level
  let riskLevel;
  if (highCount >= 2 || (highCount >= 1 && mediumCount >= 2)) {
    riskLevel = 'HIGH';
  } else if (mediumCount >= 2 || highCount >= 1) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    riskLevel,
    riskInfo: RISK_LEVELS[riskLevel],
    rawAnalysis: gptResponse
  };
}

/**
 * Extract detected signals from analysis
 */
export function extractSignals(gptResponse) {
  const signals = [];
  const response = gptResponse.toLowerCase();

  // Facial signals
  if (response.includes('face') || response.includes('facial')) {
    if (response.includes('inconsistent') || response.includes('unnatural')) {
      signals.push({
        category: SIGNAL_CATEGORIES.FACIAL,
        signal: 'Facial inconsistencies detected',
        severity: 'high'
      });
    } else if (response.includes('natural') || response.includes('consistent')) {
      signals.push({
        category: SIGNAL_CATEGORIES.FACIAL,
        signal: 'Facial features appear natural',
        severity: 'low'
      });
    }
  }

  // Lighting signals
  if (response.includes('lighting') || response.includes('shadow')) {
    if (response.includes('inconsistent') || response.includes('mismatch')) {
      signals.push({
        category: SIGNAL_CATEGORIES.VISUAL,
        signal: 'Lighting/shadow inconsistencies',
        severity: 'high'
      });
    } else {
      signals.push({
        category: SIGNAL_CATEGORIES.VISUAL,
        signal: 'Lighting appears consistent',
        severity: 'low'
      });
    }
  }

  // Edge/blending signals
  if (response.includes('edge') || response.includes('blend') || response.includes('boundary')) {
    if (response.includes('artifact') || response.includes('blur') || response.includes('unnatural')) {
      signals.push({
        category: SIGNAL_CATEGORIES.VISUAL,
        signal: 'Edge blending artifacts detected',
        severity: 'high'
      });
    }
  }

  // Temporal signals
  if (response.includes('frame') || response.includes('temporal') || response.includes('movement')) {
    if (response.includes('inconsistent') || response.includes('jitter') || response.includes('unnatural')) {
      signals.push({
        category: SIGNAL_CATEGORIES.TEMPORAL,
        signal: 'Temporal inconsistencies between frames',
        severity: 'medium'
      });
    } else {
      signals.push({
        category: SIGNAL_CATEGORIES.TEMPORAL,
        signal: 'Frame-to-frame consistency verified',
        severity: 'low'
      });
    }
  }

  // Background signals
  if (response.includes('background')) {
    if (response.includes('inconsistent') || response.includes('artifact')) {
      signals.push({
        category: SIGNAL_CATEGORIES.VISUAL,
        signal: 'Background anomalies detected',
        severity: 'medium'
      });
    }
  }

  // If no specific signals extracted, add a general one
  if (signals.length === 0) {
    signals.push({
      category: SIGNAL_CATEGORIES.VISUAL,
      signal: 'General visual analysis completed',
      severity: 'low'
    });
  }

  return signals;
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
