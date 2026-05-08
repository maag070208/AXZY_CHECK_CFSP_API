import { Router } from 'express';
import * as roundController from './round.controller';
import { authenticate } from '../common/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { StartRoundSchema, RoundIdParamSchema } from './round.schema';

const router = Router();

router.use(authenticate);

router.post('/start', validate(StartRoundSchema), roundController.startRound);
router.put('/:id/end', validate(RoundIdParamSchema), roundController.endRound);
router.get('/current', roundController.getCurrentRound);
// Web Endpoints
router.post('/datatable', roundController.getDataTable);
router.get('/', roundController.getRounds);
router.get('/:id', validate(RoundIdParamSchema), roundController.getRoundDetail);
router.get('/:id/report', validate(RoundIdParamSchema), roundController.generateReport);
router.get('/:id/share', validate(RoundIdParamSchema), roundController.shareReport);

export default router;
