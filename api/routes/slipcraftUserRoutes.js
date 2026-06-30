const express = require('express');

const {
  createCurrentUserTopUpOrderController,
  deleteCurrentUserAccountController,
  getUserPointsController,
  listCurrentUserTopUpOrdersController,
  updateCurrentUserTopUpOrderStatusController,
  updateCurrentUserProfileController
} = require('../controllers/slipcraftUserController');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  requireAuthenticatedUser,
  requireUserAuthIfConfigured
} = require('../middleware/authenticateRequest');

const router = express.Router();

router.patch('/me/profile', requireAuthenticatedUser, asyncHandler(updateCurrentUserProfileController));
router.get('/me/top-up-orders', requireAuthenticatedUser, asyncHandler(listCurrentUserTopUpOrdersController));
router.post('/me/top-up-orders', requireAuthenticatedUser, asyncHandler(createCurrentUserTopUpOrderController));
router.patch('/me/top-up-orders/:id/status', requireAuthenticatedUser, asyncHandler(updateCurrentUserTopUpOrderStatusController));
router.delete('/me', requireAuthenticatedUser, asyncHandler(deleteCurrentUserAccountController));
router.get('/:id/points', requireUserAuthIfConfigured, asyncHandler(getUserPointsController));

module.exports = {
  slipcraftUserRoutes: router
};
