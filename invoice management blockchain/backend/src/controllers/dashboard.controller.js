const dashboardService = require('../services/dashboard.service')

async function summary(req, res, next) {
  try {
    const data = await dashboardService.getSummary(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function overdue(req, res, next) {
  try {
    const data = await dashboardService.getOverdueInvoices(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function trend(req, res, next) {
  try {
    const data = await dashboardService.getCollectionsTrend(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function invoiceCountTrend(req, res, next) {
  try {
    const data = await dashboardService.getInvoiceCountTrend(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function clientAnalytics(req, res, next) {
  try {
    const data = await dashboardService.getClientAnalytics(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function clientLeaderboard(req, res, next) {
  try {
    const data = await dashboardService.getClientLeaderboard(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function cashflowPrediction(req, res, next) {
  try {
    const data = await dashboardService.getCashflowPrediction(req.user.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  summary,
  overdue,
  trend,
  invoiceCountTrend,
  clientAnalytics,
  clientLeaderboard,
  cashflowPrediction
}
