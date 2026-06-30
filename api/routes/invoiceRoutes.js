const express = require('express');

const {
  createInvoiceController,
  previewInvoiceController,
  getInvoiceTimelineController,
  getInvoiceController,
  listInvoicesController,
  refreshInvoiceController,
  sendInvoiceReminderController,
  cancelInvoiceAutoRemindersController,
  generateInvoiceQrController,
  cancelInvoiceController
} = require('../controllers/invoiceController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireUserAuthIfConfigured } = require('../middleware/authenticateRequest');

const router = express.Router();

router.post('/', requireUserAuthIfConfigured, asyncHandler(createInvoiceController));
router.post('/preview', requireUserAuthIfConfigured, asyncHandler(previewInvoiceController));
router.get('/:id/timeline', requireUserAuthIfConfigured, asyncHandler(getInvoiceTimelineController));
router.post('/:id/refresh', requireUserAuthIfConfigured, asyncHandler(refreshInvoiceController));
router.post('/:id/remind', requireUserAuthIfConfigured, asyncHandler(sendInvoiceReminderController));
router.post('/:id/cancel-reminders', requireUserAuthIfConfigured, asyncHandler(cancelInvoiceAutoRemindersController));
router.post('/:id/qr', requireUserAuthIfConfigured, asyncHandler(generateInvoiceQrController));
router.post('/:id/cancel', requireUserAuthIfConfigured, asyncHandler(cancelInvoiceController));
router.get('/:id', requireUserAuthIfConfigured, asyncHandler(getInvoiceController));
router.get('/', requireUserAuthIfConfigured, asyncHandler(listInvoicesController));

module.exports = {
  invoiceRoutes: router
};
