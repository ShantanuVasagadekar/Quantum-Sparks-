const express = require('express')
const dashboardController = require('../controllers/dashboard.controller')

const router = express.Router()

router.get('/summary', dashboardController.summary)
router.get('/overdue', dashboardController.overdue)
router.get('/collections-trend', dashboardController.trend)
router.get('/invoice-count-trend', dashboardController.invoiceCountTrend)
router.get('/client-analytics', dashboardController.clientAnalytics)
router.get('/client-leaderboard', dashboardController.clientLeaderboard)
router.get('/cashflow-prediction', dashboardController.cashflowPrediction)

module.exports = router
