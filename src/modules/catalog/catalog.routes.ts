import { Router } from "express";
import * as catalogController from './catalog.controller';

import { authenticate } from '../common/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { CatalogKeySchema } from './catalog.schema';

const router = Router();

router.use(authenticate);

router.get("/:key", validate(CatalogKeySchema), catalogController.getCatalog);

export default router;
