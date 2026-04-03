const express = require('express')
const eventController = require('../controllers/event.controller')
const { requireUserFromQuery, requireUser } = require('../middleware/auth.middleware')

const router = express.Router()

router.get('/stream', requireUserFromQuery, eventController.stream)
router.get('/stats', requireUser, eventController.stats)

module.exports = router
