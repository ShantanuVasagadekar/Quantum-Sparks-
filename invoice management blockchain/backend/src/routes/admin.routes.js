const express = require('express')
const adminController = require('../controllers/admin.controller')

const router = express.Router()

router.post('/seed-demo', adminController.seedDemo)

module.exports = router
