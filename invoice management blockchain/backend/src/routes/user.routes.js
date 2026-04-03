const express = require('express')
const userController = require('../controllers/user.controller')

const router = express.Router()

router.patch('/me/wallet', userController.updateMyWallet)

module.exports = router
