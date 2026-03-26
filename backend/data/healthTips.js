/**
 * Health Tips Database — Single Source of Truth
 *
 * Used by chatbotService, chatbotServiceV2, and enhancedChatbotService.
 * Add new categories or tips here; all services pick them up automatically.
 */

const HEALTH_TIPS = {
  general: [
    { id: 'g1', title: 'Stay Hydrated', content: 'Drink at least 8-10 glasses of water daily.', category: 'general' },
    { id: 'g2', title: 'Regular Exercise', content: 'Exercise for at least 30 minutes each day — walking counts!', category: 'general' },
    { id: 'g3', title: 'Quality Sleep', content: 'Get 7-8 hours of quality sleep every night.', category: 'general' },
    { id: 'g4', title: 'Balanced Diet', content: 'Eat a balanced diet rich in fruits, vegetables, and whole grains.', category: 'general' },
    { id: 'g5', title: 'Hand Hygiene', content: 'Wash hands regularly to prevent infections.', category: 'general' },
    { id: 'g6', title: 'Regular Checkups', content: 'Schedule health checkups at least once a year.', category: 'general' },
    { id: 'g7', title: 'Limit Sugar', content: 'Reduce sugar and processed food intake for better health.', category: 'general' },
    { id: 'g8', title: 'Stress Management', content: 'Practice meditation or deep breathing for stress relief.', category: 'general' },
  ],
  diabetes: [
    { id: 'd1', title: 'Monitor Blood Sugar', content: 'Check blood sugar levels as recommended by your doctor.', category: 'diabetes' },
    { id: 'd2', title: 'Low-Glycemic Diet', content: 'Prefer foods with low glycemic index to manage blood sugar.', category: 'diabetes' },
    { id: 'd3', title: 'Daily Exercise', content: 'Regular exercise improves insulin sensitivity.', category: 'diabetes' },
    { id: 'd4', title: 'Foot Care', content: 'Check feet daily for cuts, blisters, or swelling.', category: 'diabetes' },
    { id: 'd5', title: 'HbA1c Target', content: 'Aim to keep HbA1c below 7% — discuss with your doctor.', category: 'diabetes' },
  ],
  heart: [
    { id: 'h1', title: 'BP Monitoring', content: 'Monitor blood pressure regularly at home.', category: 'heart' },
    { id: 'h2', title: 'Reduce Salt', content: 'Limit sodium intake to reduce heart disease risk.', category: 'heart' },
    { id: 'h3', title: 'Healthy Weight', content: 'Maintain a healthy BMI for heart health.', category: 'heart' },
    { id: 'h4', title: 'Quit Smoking', content: 'Smoking doubles your risk of heart disease.', category: 'heart' },
    { id: 'h5', title: 'Heart-Healthy Foods', content: 'Include nuts, fish, and olive oil in your diet.', category: 'heart' },
  ],
  mental: [
    { id: 'm1', title: 'Mindfulness', content: 'Practice 10 minutes of mindfulness meditation daily.', category: 'mental' },
    { id: 'm2', title: 'Stay Connected', content: 'Regular social connections improve mental well-being.', category: 'mental' },
    { id: 'm3', title: 'Seek Help', content: 'It\'s okay to ask for professional help when needed.', category: 'mental' },
    { id: 'm4', title: 'Screen Time', content: 'Limit screen time, especially before bed.', category: 'mental' },
    { id: 'm5', title: 'Enjoyable Activities', content: 'Do things you enjoy — hobbies reduce stress significantly.', category: 'mental' },
  ],
  pregnancy: [
    { id: 'p1', title: 'Prenatal Vitamins', content: 'Take folic acid and prenatal vitamins as prescribed.', category: 'pregnancy' },
    { id: 'p2', title: 'Regular Checkups', content: 'Never miss antenatal checkup appointments.', category: 'pregnancy' },
    { id: 'p3', title: 'Avoid Alcohol', content: 'Completely avoid alcohol and tobacco during pregnancy.', category: 'pregnancy' },
    { id: 'p4', title: 'Stay Hydrated', content: 'Drink plenty of water and eat nutritious foods.', category: 'pregnancy' },
    { id: 'p5', title: 'Gentle Exercise', content: 'Walking and prenatal yoga are safe and beneficial.', category: 'pregnancy' },
  ],
};

/**
 * Get tips as plain strings (for v1 chatbot service backward compat)
 */
const getHealthTipsAsStrings = (category = 'general') => {
  const tips = HEALTH_TIPS[category] || HEALTH_TIPS.general;
  return tips.map(t => t.content);
};

module.exports = { HEALTH_TIPS, getHealthTipsAsStrings };
