const express = require('express');

const {
  getBootstrapController,
  getCurrentUserCommandCenterController,
  getCurrentUserController
} = require('../controllers/bootstrapController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const bootstrapRouter = express.Router();
const meRouter = express.Router();

bootstrapRouter.get('/', asyncHandler(getBootstrapController));
meRouter.get('/command-center', requireAuthenticatedUser, asyncHandler(getCurrentUserCommandCenterController));
meRouter.get('/', requireAuthenticatedUser, asyncHandler(getCurrentUserController));

module.exports = {
  bootstrapRoutes: bootstrapRouter,
  meRoutes: meRouter
};
