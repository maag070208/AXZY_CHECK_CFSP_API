import { Router } from "express";
import * as catalogController from './catalog.controller';

import { authenticate } from '../common/middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get("/:key", catalogController.getCatalog);

export default router;
