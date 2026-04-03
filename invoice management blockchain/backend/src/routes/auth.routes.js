const express = require('express')
const authController = require('../controllers/auth.controller')
const { requireUser } = require('../middleware/auth.middleware')

const router = express.Router()

router.post('/signup', authController.signup)
router.post('/login', authController.login)
router.get('/me', requireUser, authController.me)
router.put('/profile', requireUser, authController.updateProfile)

module.exports = router
