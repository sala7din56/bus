const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const auth = require('../middleware/auth');

router.get('/', auth, settingController.listSettings);
router.put('/:key', auth, settingController.upsertSetting);
router.delete('/:key', auth, settingController.deleteSetting);

module.exports = router;
