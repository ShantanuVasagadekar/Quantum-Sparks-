const express = require('express')
const clientController = require('../controllers/client.controller')

const router = express.Router()

router.get('/', clientController.list)
router.post('/', clientController.create)
router.get('/:id', clientController.getById)
router.patch('/:id', clientController.update)
router.delete('/:id', clientController.remove)

module.exports = router
