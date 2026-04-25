const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/signUp', authController.signUp);
router.post('/signUpConfirm', authController.signUpConfirm);
router.post('/authenticate', authController.authenticate);
router.post('/forgotPassword/:username', authController.forgotPassword);
router.post('/confirmPassword/:username/:code/:newpassword', authController.confirmPassword);
router.post('/resendCode', authController.resendCode);

module.exports = router;