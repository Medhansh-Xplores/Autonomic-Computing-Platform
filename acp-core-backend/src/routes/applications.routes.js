const express = require('express');
const router = express.Router();
const applicationsController = require('../controllers/applications.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/generate', authMiddleware, applicationsController.generateApplication);
router.get('/list', authMiddleware, applicationsController.listApplications);
router.delete('/record/:id', authMiddleware, applicationsController.deleteApplication);

module.exports = router;