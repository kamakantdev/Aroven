/**
 * Medical Guardrails & Emergency Rule Engine
 *
 * Safety layer between user input and AI response:
 *   1. PRE-PROCESSING: Emergency keyword detection → override AI
 *   2. POST-PROCESSING: Strip any prescriptions, dosages, diagnoses from AI output
 *   3. EMERGENCY ENGINE: Rule-based detection with confidence scoring
 *
 * Emergency keywords trigger IMMEDIATE response without AI,
 * ensuring sub-100ms response for life-threatening situations.
 */

// ==================== EMERGENCY RULE ENGINE ====================

const EMERGENCY_RULES = [
  {
    id: 'chest_pain',
    keywords: ['chest pain', 'chest hurts', 'pain in chest', 'heart attack', 'cardiac arrest'],
    severity: 'critical',
    confidence: 0.95,
    response: '🚨 EMERGENCY: Chest pain detected.\n\n1. Call 102/108 immediately\n2. Chew an aspirin if available and not allergic\n3. Sit upright, loosen tight clothing\n4. Do NOT exert yourself\n5. If unconscious, start CPR\n\n⚠️ This could be a heart attack. Every minute matters.',
    specialist: 'Cardiologist / Emergency',
  },
  {
    id: 'stroke',
    keywords: ['stroke', 'face drooping', 'arm weakness', 'speech difficulty', 'slurred speech', 'cant move arm', 'one side numb'],
    severity: 'critical',
    confidence: 0.95,
    response: '🚨 EMERGENCY: Possible stroke detected.\n\nRemember F.A.S.T.:\n• Face drooping?\n• Arm weakness?\n• Speech difficulty?\n• Time to call 102/108!\n\n1. Note the time symptoms started\n2. Do NOT give food or water\n3. Keep the person lying down\n4. Stay with them until help arrives',
    specialist: 'Neurologist / Emergency',
  },
  {
    id: 'unconscious',
    keywords: ['unconscious', 'not breathing', 'stopped breathing', 'no pulse', 'collapsed', 'fainted and not waking'],
    severity: 'critical',
    confidence: 0.95,
    response: '🚨 EMERGENCY: Unconscious/not breathing.\n\n1. Call 102/108 NOW\n2. Check for breathing (look, listen, feel)\n3. If not breathing → Start CPR:\n   - 30 chest compressions\n   - 2 rescue breaths\n   - Repeat until help arrives\n4. Use AED if available\n5. Do NOT leave the person alone',
    specialist: 'Emergency Medicine',
  },
  {
    id: 'severe_bleeding',
    keywords: ['severe bleeding', 'wont stop bleeding', 'blood everywhere', 'deep cut', 'arterial bleeding', 'spurting blood'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Severe bleeding.\n\n1. Call 102/108 immediately\n2. Apply direct pressure with clean cloth\n3. Do NOT remove the cloth — add more layers\n4. Elevate the injured area above heart level\n5. If limb: apply tourniquet 2-3 inches above wound\n6. Keep the person warm and calm',
    specialist: 'Emergency / Surgeon',
  },
  {
    id: 'suicidal',
    keywords: ['suicidal', 'kill myself', 'want to die', 'end my life', 'no reason to live', 'suicide', 'self harm', 'cutting myself'],
    severity: 'critical',
    confidence: 0.95,
    response: '💙 I hear you, and your life matters.\n\n🆘 Immediate Help:\n• Vandrevala Foundation: 1860-2662-345 (24/7)\n• iCall: 9152987821\n• AASRA: 9820466626\n• National Emergency: 112\n\nPlease reach out to someone right now. You don\'t have to face this alone.\n\nIf you\'re in immediate danger, please call 112.',
    specialist: 'Psychiatrist / Crisis',
  },
  {
    id: 'choking',
    keywords: ['choking', 'something stuck in throat', 'airway blocked'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Choking.\n\n1. If person can cough → Encourage forceful coughing\n2. If person CANNOT cough/breathe → Heimlich maneuver:\n   - Stand behind, fist above navel\n   - Quick upward thrusts\n   - Repeat until object dislodges\n3. If unconscious → Call 102, start CPR\n4. For infants: 5 back blows + 5 chest thrusts',
    specialist: 'Emergency',
  },
  {
    id: 'allergic_reaction',
    keywords: ['anaphylaxis', 'allergic reaction severe', 'throat swelling', 'cant swallow', 'hives all over', 'epipen'],
    severity: 'critical',
    confidence: 0.85,
    response: '🚨 EMERGENCY: Severe allergic reaction.\n\n1. Call 102/108 immediately\n2. Use EpiPen if available (thigh injection)\n3. Have person lie down, legs elevated\n4. Loosen tight clothing\n5. If vomiting → turn on side\n6. Be ready to start CPR\n7. Do NOT give anything by mouth',
    specialist: 'Emergency / Allergist',
  },
  {
    id: 'poisoning',
    keywords: ['overdose', 'poisoned', 'drank poison', 'took too many pills', 'drug overdose', 'swallowed chemicals'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Poisoning/Overdose.\n\n1. Call 102/108 and Poison Control: 1066\n2. Do NOT make the person vomit\n3. If conscious → Keep them sitting up\n4. If unconscious → Recovery position (on side)\n5. Save the container/substance for paramedics\n6. Note what was taken and when',
    specialist: 'Emergency / Toxicology',
  },
  {
    id: 'breathing_difficulty',
    keywords: ['difficulty breathing', 'cant breathe', 'breathless', 'gasping for air', 'severe asthma attack'],
    severity: 'high',
    confidence: 0.8,
    response: '⚠️ URGENT: Breathing difficulty.\n\n1. Sit upright — do NOT lie down\n2. Use inhaler if prescribed (2 puffs)\n3. Loosen tight clothing\n4. Open windows for fresh air\n5. Practice pursed-lip breathing\n6. If no improvement in 5 minutes → Call 102/108\n\n⚠️ If lips/fingers turn blue, call emergency immediately.',
    specialist: 'Pulmonologist / Emergency',
  },
  {
    id: 'seizure',
    keywords: ['seizure', 'convulsions', 'fitting', 'epileptic fit', 'shaking uncontrollably'],
    severity: 'high',
    confidence: 0.85,
    response: '⚠️ URGENT: Seizure/Convulsions.\n\n1. Clear area of hard/sharp objects\n2. Do NOT hold the person down\n3. Do NOT put anything in their mouth\n4. Turn on side when seizure stops\n5. Time the seizure — call 102 if > 5 minutes\n6. Stay with them until fully alert\n7. Do NOT give food/water until fully conscious',
    specialist: 'Neurologist / Emergency',
  },
  // ── NEW EMERGENCY RULES (expanded coverage) ──
  {
    id: 'severe_burns',
    keywords: ['severe burn', 'burnt badly', 'skin melting', 'chemical burn', 'boiling water burn', 'fire burn', 'third degree burn'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Severe burn.\n\n1. Call 102/108 immediately\n2. Cool the burn under running water for 20 minutes\n3. Do NOT use ice, butter, or toothpaste\n4. Do NOT pop blisters\n5. Cover loosely with clean, wet cloth\n6. Remove jewelry/clothing near burn (not if stuck)\n7. If chemical burn → rinse with water for 20+ minutes\n\n⚠️ Large or deep burns need urgent hospital care.',
    specialist: 'Emergency / Plastic Surgeon',
  },
  {
    id: 'snake_bite',
    keywords: ['snake bite', 'bitten by snake', 'snake bit me', 'scorpion sting', 'animal bite'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Snake/animal bite.\n\n1. Call 102/108 immediately\n2. Keep the person CALM and STILL\n3. Immobilize the bitten limb below heart level\n4. Remove rings/jewelry near bite site\n5. Do NOT cut the wound or suck venom\n6. Do NOT apply tourniquet or ice\n7. Mark the edge of swelling with pen + time\n8. Try to remember the snake\'s appearance\n\n⚠️ Get to a hospital with anti-venom ASAP.',
    specialist: 'Emergency / Toxicology',
  },
  {
    id: 'drowning',
    keywords: ['drowning', 'almost drowned', 'swallowed water', 'near drowning', 'pulled from water'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Drowning/near-drowning.\n\n1. Call 102/108 immediately\n2. If not breathing → Start CPR immediately\n3. Do NOT try to drain water from lungs\n4. Lay on side to prevent choking on vomit\n5. Remove wet clothing, keep warm\n6. Even if person seems fine → MUST go to hospital\n\n⚠️ Secondary drowning can occur hours later.',
    specialist: 'Emergency Medicine',
  },
  {
    id: 'head_trauma',
    keywords: ['head injury', 'hit my head', 'skull fracture', 'head trauma', 'fell on head', 'concussion', 'bleeding from head'],
    severity: 'critical',
    confidence: 0.85,
    response: '🚨 EMERGENCY: Head injury.\n\n1. Call 102/108 immediately\n2. Keep person still — do NOT move neck\n3. Apply gentle pressure on bleeding with clean cloth\n4. Do NOT remove objects stuck in wound\n5. Watch for: vomiting, confusion, unequal pupils, seizures\n6. If unconscious → recovery position, monitor breathing\n\n⚠️ All head injuries need medical evaluation.',
    specialist: 'Neurosurgeon / Emergency',
  },
  {
    id: 'electrocution',
    keywords: ['electric shock', 'electrocuted', 'electrocution', 'lightning struck', 'electric current'],
    severity: 'critical',
    confidence: 0.9,
    response: '🚨 EMERGENCY: Electric shock.\n\n1. Do NOT touch the person if still in contact with source\n2. Turn off power source or use dry non-metal object to separate\n3. Call 102/108 immediately\n4. Check breathing — start CPR if needed\n5. Cover burns with sterile bandage\n6. Watch for cardiac arrest — stay ready for CPR\n\n⚠️ Internal injuries may not be visible. Hospital care is essential.',
    specialist: 'Emergency / Cardiologist',
  },
  {
    id: 'diabetic_emergency',
    keywords: ['sugar very low', 'hypoglycemia', 'diabetic coma', 'sugar very high', 'blood sugar 400', 'blood sugar 500', 'dka', 'diabetic ketoacidosis'],
    severity: 'high',
    confidence: 0.85,
    response: '⚠️ URGENT: Diabetic emergency.\n\n🔽 LOW sugar (hypoglycemia):\n1. Give glucose tablets, juice, or sugar immediately\n2. If unconscious → Do NOT give food/drink\n3. Place sugar/honey under tongue\n4. Call 102 if no improvement in 15 mins\n\n🔼 HIGH sugar (hyperglycemia/DKA):\n1. Check for fruity breath, nausea, confusion\n2. Give water (if conscious)\n3. Do NOT skip insulin\n4. Go to hospital immediately\n\n⚠️ Both need urgent medical attention.',
    specialist: 'Endocrinologist / Emergency',
  },
  {
    id: 'heat_stroke',
    keywords: ['heat stroke', 'heatstroke', 'sun stroke', 'overheating', 'body very hot', 'heat exhaustion'],
    severity: 'high',
    confidence: 0.85,
    response: '⚠️ URGENT: Heat stroke.\n\n1. Move to shade/AC immediately\n2. Call 102/108 if body temp > 104°F / 40°C\n3. Cool the body: wet cloths on neck, armpits, groin\n4. Fan the person, spray with cool water\n5. Give small sips of cool water (if conscious)\n6. Do NOT give very cold water or ice bath\n7. Loosen/remove excess clothing\n\n⚠️ Heat stroke can cause organ damage — get medical help.',
    specialist: 'Emergency Medicine',
  },
];

// ==================== GUARDRAIL PATTERNS ====================

/**
 * Patterns that should NEVER appear in AI responses.
 * These are stripped/replaced in post-processing.
 */
const FORBIDDEN_PATTERNS = [
  // Specific drug dosages
  /take (\d+)\s*mg/gi,
  /dose(?:age)?\s*(?:is|:)\s*\d+\s*(?:mg|ml|mcg|iu|units)/gi,
  /(\d+)\s*(?:mg|ml|mcg|iu)\s*(?:once|twice|thrice|daily|per day)/gi,
  // Spelled-out dosage (e.g. "take two tablets")
  /take\s+(?:one|two|three|four|five|six|half|a)\s+(?:tablet|capsule|pill|spoon|drop)s?/gi,
  // Direct prescriptions
  /i (?:prescribe|recommend taking)\s+[A-Z][a-z]+\s+\d+/gi,
  /you should take\s+[A-Z][a-z]+\s+\d+\s*mg/gi,
  // Definitive diagnosis
  /you (?:have|are suffering from|are diagnosed with)\s+[A-Z]/gi,
  /(?:my )?diagnosis (?:is|:)\s+/gi,
  /i can confirm (?:you have|that this is)/gi,
  // Tablet counts
  /\d+\s*(?:tablet|capsule|pill)s?\s+(?:a day|daily|per day|twice|thrice)/gi,
];

const DISCLAIMER = '\n\n⚕️ *This is AI-generated health information, not a medical diagnosis. Please consult a qualified healthcare professional for proper evaluation and treatment.*';

// ==================== PUBLIC API ====================

/**
 * Pre-process user message: check for emergencies BEFORE calling AI.
 * Returns emergency response if matched, null otherwise.
 */
function checkEmergency(message) {
  if (!message) return null;

  const lowerMessage = message.toLowerCase();
  let bestMatch = null;
  let bestConfidence = 0;

  for (const rule of EMERGENCY_RULES) {
    for (const keyword of rule.keywords) {
      // Use word-boundary regex to avoid false positives
      // e.g. "cant breathe" shouldn't match inside "decant breathe-easy"
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lowerMessage)) {
        if (rule.confidence > bestConfidence) {
          bestConfidence = rule.confidence;
          bestMatch = rule;
        }
      }
    }
  }

  if (bestMatch && bestConfidence >= 0.8) {
    return {
      isEmergency: true,
      ruleId: bestMatch.id,
      severity: bestMatch.severity,
      confidence: bestConfidence,
      response: bestMatch.response,
      specialist: bestMatch.specialist,
      requiresEmergency: bestMatch.severity === 'critical',
      emergencyNumbers: {
        ambulance: '102/108',
        national: '112',
        poisonControl: '1066',
      },
    };
  }

  return null;
}

/**
 * Post-process AI response: strip forbidden content + add disclaimer.
 */
function sanitizeResponse(aiResponse) {
  if (!aiResponse) return aiResponse;

  let sanitized = aiResponse;

  for (const pattern of FORBIDDEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Replace dosage-specific content with safe alternative
      return '[consult your doctor for specific dosage]';
    });
  }

  // Always add disclaimer if not already present
  // Check for the full disclaimer phrases, not partial word matches
  const hasDisclaimer = sanitized.includes('AI-generated health information') ||
    sanitized.includes('not a medical diagnosis') ||
    sanitized.includes('consult a qualified healthcare professional') ||
    sanitized.includes('Please consult a doctor') ||
    sanitized.includes('consult your doctor for');
  if (!hasDisclaimer) {
    sanitized += DISCLAIMER;
  }

  return sanitized;
}

/**
 * Detect severity level from user message (for structured response).
 */
function detectSeverity(message) {
  if (!message) return 'low';

  const lowerMessage = message.toLowerCase();

  const criticalKeywords = ['emergency', 'dying', 'heart attack', 'stroke', 'unconscious', 'not breathing', 'severe bleeding', 'suicide'];
  const highKeywords = ['severe', 'unbearable', 'extreme', 'worst pain', 'can\'t move', 'can\'t breathe', 'blood'];
  const mediumKeywords = ['pain', 'fever', 'vomiting', 'dizzy', 'swelling', 'infection', 'rash', 'nausea'];

  if (criticalKeywords.some(k => lowerMessage.includes(k))) return 'critical';
  if (highKeywords.some(k => lowerMessage.includes(k))) return 'high';
  if (mediumKeywords.some(k => lowerMessage.includes(k))) return 'medium';
  return 'low';
}

/**
 * Detect recommended specialist from message content.
 */
function detectSpecialist(message) {
  if (!message) return 'General Physician';

  const lowerMessage = message.toLowerCase();

  const specialistMap = {
    'Cardiologist': ['heart', 'chest pain', 'palpitations', 'blood pressure', 'cholesterol', 'ecg'],
    'Dermatologist': ['skin', 'rash', 'acne', 'eczema', 'hair loss', 'itching', 'psoriasis'],
    'Orthopedic': ['bone', 'joint', 'back pain', 'fracture', 'arthritis', 'knee', 'spine', 'shoulder'],
    'Neurologist': ['headache', 'migraine', 'dizziness', 'numbness', 'seizure', 'brain', 'nerve'],
    'Gastroenterologist': ['stomach', 'digestion', 'acid reflux', 'constipation', 'diarrhea', 'liver', 'gastric'],
    'Pulmonologist': ['breathing', 'cough', 'asthma', 'lungs', 'respiratory', 'wheezing'],
    'ENT Specialist': ['ear', 'nose', 'throat', 'sinus', 'hearing', 'tonsils'],
    'Ophthalmologist': ['eye', 'vision', 'glasses', 'cataract', 'glaucoma'],
    'Gynecologist': ['period', 'pregnancy', 'menstrual', 'pcod', 'pcos', 'uterus'],
    'Pediatrician': ['child', 'baby', 'infant', 'toddler', 'newborn'],
    'Psychiatrist': ['anxiety', 'depression', 'stress', 'insomnia', 'mental health', 'panic'],
    'Urologist': ['urine', 'kidney', 'bladder', 'prostate'],
    'Endocrinologist': ['diabetes', 'thyroid', 'hormone', 'sugar levels'],
    'Oncologist': ['cancer', 'tumor', 'lump', 'biopsy'],
  };

  for (const [specialist, keywords] of Object.entries(specialistMap)) {
    if (keywords.some(k => lowerMessage.includes(k))) {
      return specialist;
    }
  }

  return 'General Physician';
}

/**
 * Get the production-grade system prompt for healthcare AI.
 */
function getSystemPrompt(language = 'en') {
  const langInstruction = language === 'hi'
    ? `\n\nLANGUAGE: You MUST respond in Hindi (Devanagari script). The patient speaks Hindi. Write the "summary" and "follow_up_question" fields entirely in Hindi using Devanagari script (e.g. "आपको बुखार है..."). Keep medical terms in English where helpful but wrap them with Hindi explanation. Specialist names should be in English.`
    : `\n\nLANGUAGE: Respond in simple, clear English. The patient may be from India, so use culturally appropriate context.`;

  return `You are Swastik Health Assistant, an AI-powered healthcare advisor for the Swastik Healthcare Platform serving patients across India.

ROLE & CAPABILITIES:
- Provide general health information, first aid guidance, and wellness advice
- Help users understand symptoms and suggest which specialist to consult
- Answer general medication queries (uses, side effects, interactions)
- Provide preventive healthcare tips and lifestyle recommendations
- Help patients prepare questions for their doctor visits

STRICT RULES (NEVER VIOLATE):
1. NEVER diagnose conditions — only suggest possibilities and recommend professional consultation
2. NEVER prescribe medications or specific dosages — say "consult your doctor"
3. NEVER provide dosage instructions — redirect to prescribing physician
4. NEVER claim certainty about a condition — use phrases like "this could indicate", "possible causes include"
5. NEVER discourage seeking medical help — always recommend professional consultation
6. For ANY emergency symptoms → immediately recommend calling 102/108
7. Always include a brief disclaimer that you're an AI, not a doctor

RESPONSE FORMAT:
- Keep responses concise (150-250 words)
- Use bullet points for lists
- Use emojis sparingly for warmth (🏥 ⚕️ 💊 🩺)
- Be empathetic, warm, and culturally sensitive to Indian context
- End with a relevant follow-up question when appropriate
${langInstruction}

EMERGENCY PROTOCOL:
If user mentions: chest pain, difficulty breathing, severe bleeding, loss of consciousness, suicidal thoughts, poisoning, seizures
→ IMMEDIATELY provide emergency numbers (102/108/112) and first aid steps
→ Do NOT continue normal conversation flow

EMERGENCY NUMBERS (India):
- Ambulance: 102 / 108
- National Emergency: 112
- Poison Control: 1066
- Mental Health: 1860-2662-345 (Vandrevala Foundation)

You must respond ONLY with a JSON object in this exact format:
{
  "summary": "Your conversational response text here",
  "possible_conditions": ["condition1", "condition2"],
  "severity": "low|medium|high|critical",
  "recommended_specialist": "Specialist Type",
  "requires_emergency": false,
  "confidence_score": 0.7,
  "follow_up_question": "Optional follow-up question?"
}

If the message is general conversation (greetings, thanks, etc.), set possible_conditions to [], severity to "low", recommended_specialist to "General Physician", requires_emergency to false, and confidence_score to 0.5.`;
}

module.exports = {
  checkEmergency,
  sanitizeResponse,
  detectSeverity,
  detectSpecialist,
  getSystemPrompt,
  EMERGENCY_RULES,
};
