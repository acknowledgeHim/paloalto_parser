import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { copyStatus, watchingNow } from '../services/movieLibrary.js';
import { piHealth } from '../services/piHealth.js';
/** 📊 HomeCenter Resource Usage (🛠️ More): CPU, temperature, memory, disk, network, who's watching. */
export const resourcesRouter = Router();
resourcesRouter.get('/', asyncHandler(async (_req, res) => {
    res.json({ ...(await piHealth()), watching: watchingNow(), copy_paused: copyStatus.paused });
}));
