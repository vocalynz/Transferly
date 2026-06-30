const express = require('express');

const {
  createServiceLaneActionIntentController,
  getServiceCommandCenterSummaryController,
  getServiceLaneDetailController
} = require('../controllers/serviceController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const serviceRouter = express.Router();

serviceRouter.get(
  '/:slug/command-center',
  requireAuthenticatedUser,
  asyncHandler(getServiceCommandCenterSummaryController)
);

serviceRouter.get(
  '/:slug/lanes/:laneId',
  requireAuthenticatedUser,
  asyncHandler(getServiceLaneDetailController)
);

serviceRouter.post(
  '/:slug/lanes/:laneId/actions',
  requireAuthenticatedUser,
  asyncHandler(createServiceLaneActionIntentController)
);

module.exports = {
  serviceRoutes: serviceRouter
};
