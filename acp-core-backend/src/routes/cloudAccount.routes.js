const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cloudAccount.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware); // protect all routes

router.get('/', ctrl.getAccounts);
router.post('/', ctrl.addAccount);
router.put('/:id', ctrl.updateAccount);
router.delete('/:id', ctrl.deleteAccount);
router.put('/:id/set-default', ctrl.setDefault);
router.post('/:id/verify', ctrl.verifyConnection);
router.get('/new-external-id', ctrl.getNewExternalId);
router.get('/', ctrl.getAccounts);
router.post('/', ctrl.addAccount);

module.exports = router;