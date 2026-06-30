const { transaction } = require('../db');
const { faqRepository } = require('../repositories/faqRepository');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { testimonialRepository } = require('../repositories/testimonialRepository');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { auditLogService } = require('./auditLogService');

function normalizeConfigUpdates(updates) {
  const normalized = { ...updates };

  if (Array.isArray(normalized.helpFAQ)) {
    normalized.helpFAQ = JSON.stringify(normalized.helpFAQ);
  }

  if (Array.isArray(normalized.help_faq)) {
    normalized.help_faq = JSON.stringify(normalized.help_faq);
  }

  if (normalized.avatar === '') {
    normalized.avatar = null;
  }

  return normalized;
}

async function getFaqOrThrow(id, client) {
  const faq = await faqRepository.findById(id, client);
  if (!faq) {
    throw new AppError(404, 'FAQ_NOT_FOUND', 'FAQ entry not found.');
  }

  return faq;
}

async function getTestimonialOrThrow(id, client) {
  const testimonial = await testimonialRepository.findById(id, client);
  if (!testimonial) {
    throw new AppError(404, 'TESTIMONIAL_NOT_FOUND', 'Testimonial not found.');
  }

  return testimonial;
}

async function updateConfig({ updates, adminActorId }) {
  return transaction(async (client) => {
    const config = await platformConfigRepository.update(normalizeConfigUpdates(updates), client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.config_updated',
        entityType: 'platform_config',
        entityId: 'default',
        metadata: {
          updated_fields: Object.keys(updates)
        }
      },
      client
    );

    return config;
  });
}

async function createFaq({ input, adminActorId }) {
  return transaction(async (client) => {
    const faq = await faqRepository.create(input, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.faq_created',
        entityType: 'faq',
        entityId: faq.id,
        metadata: {
          question: faq.question,
          order_index: faq.order_index
        }
      },
      client
    );

    return faq;
  });
}

async function updateFaq({ id, updates, adminActorId }) {
  return transaction(async (client) => {
    const existing = await getFaqOrThrow(id, client);
    const faq = await faqRepository.update(id, updates, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.faq_updated',
        entityType: 'faq',
        entityId: faq.id,
        metadata: {
          previous_question: existing.question,
          updated_fields: Object.keys(updates)
        }
      },
      client
    );

    return faq;
  });
}

async function deleteFaq({ id, adminActorId }) {
  return transaction(async (client) => {
    const faq = await getFaqOrThrow(id, client);
    await faqRepository.remove(id, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.faq_deleted',
        entityType: 'faq',
        entityId: faq.id,
        metadata: {
          question: faq.question
        }
      },
      client
    );

    return { id, deleted: true };
  });
}

async function createTestimonial({ input, adminActorId }) {
  return transaction(async (client) => {
    const testimonial = await testimonialRepository.create(normalizeConfigUpdates(input), client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.testimonial_created',
        entityType: 'testimonial',
        entityId: testimonial.id,
        metadata: {
          name: testimonial.name,
          order_index: testimonial.order_index
        }
      },
      client
    );

    return testimonial;
  });
}

async function updateTestimonial({ id, updates, adminActorId }) {
  return transaction(async (client) => {
    const existing = await getTestimonialOrThrow(id, client);
    const testimonial = await testimonialRepository.update(
      id,
      normalizeConfigUpdates(updates),
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.testimonial_updated',
        entityType: 'testimonial',
        entityId: testimonial.id,
        metadata: {
          previous_name: existing.name,
          updated_fields: Object.keys(updates)
        }
      },
      client
    );

    return testimonial;
  });
}

async function deleteTestimonial({ id, adminActorId }) {
  return transaction(async (client) => {
    const testimonial = await getTestimonialOrThrow(id, client);
    await testimonialRepository.remove(id, client);

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'slipcraft.admin.testimonial_deleted',
        entityType: 'testimonial',
        entityId: testimonial.id,
        metadata: {
          name: testimonial.name
        }
      },
      client
    );

    return { id, deleted: true };
  });
}

module.exports = {
  adminContentService: {
    updateConfig,
    createFaq,
    updateFaq,
    deleteFaq,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial
  }
};
