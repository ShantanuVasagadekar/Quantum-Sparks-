function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function calculateRiskScore({ avgDelayDays = 0, overdueInvoices = 0, partialRatio = 0 }) {
  const score = avgDelayDays * 6 + overdueInvoices * 18 + partialRatio * 25
  return Math.round(clamp(score, 0, 100))
}

function riskLevelFromScore(score) {
  if (score >= 67) return 'High Risk'
  if (score >= 34) return 'Medium Risk'
  return 'Low Risk'
}

module.exports = {
  calculateRiskScore,
  riskLevelFromScore
}
