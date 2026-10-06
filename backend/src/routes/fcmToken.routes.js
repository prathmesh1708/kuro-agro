import express from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { saveToken, removeToken, testNotification } from '../controllers/fcmToken.controller.js';

const router = express.Router();

router.post('/save', authenticate, saveToken);
router.post('/mobile/save', authenticate, saveToken);
router.delete('/remove', authenticate, removeToken);
router.post('/test', authenticate, testNotification);

export default router;
