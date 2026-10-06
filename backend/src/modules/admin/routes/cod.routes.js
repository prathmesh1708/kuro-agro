import { Router } from 'express';
import * as codController from '../controllers/cod.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';

const router = Router();
const adminAuth = [authenticate, authorize('admin', 'superadmin'), enforceAccountStatus];

router.get('/users', ...adminAuth, codController.getCodUsers);
router.get('/users/:userId/timeline', ...adminAuth, codController.getUserCodTimeline);
router.post('/users/:userId/warn', ...adminAuth, codController.issueUserWarning);
router.post('/users/:userId/blacklist', ...adminAuth, codController.toggleUserBlacklist);

export default router;
