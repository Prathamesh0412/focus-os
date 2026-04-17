import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { BlockedDomainSchema, AllowedDomainSchema } from '@focus-os/types';
import { isValidDomain } from '@focus-os/utils';

const router = Router();

// Validation schemas
const CreateBlockedDomainSchema = z.object({
  domain: z.string().min(1),
  reason: z.string().optional(),
});

const CreateAllowedDomainSchema = z.object({
  domain: z.string().min(1),
  category: z.string().optional(),
});

const UpdateUserSettingsSchema = z.object({
  defaultSessionMinutes: z.number().min(5).max(240).optional(),
  distractionTimeoutMinutes: z.number().min(1).max(30).optional(),
  gracePeriodSeconds: z.number().min(10).max(300).optional(),
  autoCloseEnabled: z.boolean().optional(),
  warningEnabled: z.boolean().optional(),
  ignorePinnedTabs: z.boolean().optional(),
  trackNewTabs: z.boolean().optional(),
  syncEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  language: z.string().optional(),
});

/**
 * Get user settings
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  let userSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  // Create settings if they don't exist
  if (!userSettings) {
    userSettings = await prisma.userSettings.create({
      data: { userId },
    });
  }

  res.json({
    settings: userSettings,
  });
}));

/**
 * Update user settings
 */
router.patch('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const updateData = UpdateUserSettingsSchema.parse(req.body);

  const userSettings = await prisma.userSettings.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      ...updateData,
    },
  });

  res.json({
    message: 'Settings updated successfully',
    settings: userSettings,
  });
}));

/**
 * Get blocked domains
 */
router.get('/blocked-domains', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { page = '1', limit = '50', search } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { userId, isActive: true };

  if (search) {
    where.domain = { contains: search as string, mode: 'insensitive' };
  }

  const [domains, total] = await Promise.all([
    prisma.blockedDomain.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.blockedDomain.count({ where }),
  ]);

  res.json({
    domains: domains.map(domain => BlockedDomainSchema.parse(domain)),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

/**
 * Add a blocked domain
 */
router.post('/blocked-domains', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { domain, reason } = CreateBlockedDomainSchema.parse(req.body);

  // Validate domain format
  if (!isValidDomain(domain)) {
    throw new AppError('Invalid domain format', 400);
  }

  // Check if domain already exists
  const existingDomain = await prisma.blockedDomain.findFirst({
    where: {
      userId,
      domain: domain.toLowerCase(),
    },
  });

  if (existingDomain) {
    if (existingDomain.isActive) {
      throw new AppError('Domain is already blocked', 409);
    } else {
      // Reactivate existing domain
      const reactivatedDomain = await prisma.blockedDomain.update({
        where: { id: existingDomain.id },
        data: {
          isActive: true,
          reason,
          updatedAt: new Date(),
        },
      });

      return res.status(201).json({
        message: 'Domain blocked successfully',
        domain: BlockedDomainSchema.parse(reactivatedDomain),
      });
    }
  }

  const blockedDomain = await prisma.blockedDomain.create({
    data: {
      userId,
      domain: domain.toLowerCase(),
      reason,
    },
  });

  res.status(201).json({
    message: 'Domain blocked successfully',
    domain: BlockedDomainSchema.parse(blockedDomain),
  });
}));

/**
 * Update a blocked domain
 */
router.patch('/blocked-domains/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const domainId = req.params.id;
  const { reason, isActive } = req.body;

  const domain = await prisma.blockedDomain.findFirst({
    where: {
      id: domainId,
      userId,
    },
  });

  if (!domain) {
    throw new AppError('Blocked domain not found', 404);
  }

  const updatedDomain = await prisma.blockedDomain.update({
    where: { id: domainId },
    data: {
      ...(reason !== undefined && { reason }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    },
  });

  res.json({
    message: 'Blocked domain updated successfully',
    domain: BlockedDomainSchema.parse(updatedDomain),
  });
}));

/**
 * Delete a blocked domain
 */
router.delete('/blocked-domains/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const domainId = req.params.id;

  const domain = await prisma.blockedDomain.findFirst({
    where: {
      id: domainId,
      userId,
    },
  });

  if (!domain) {
    throw new AppError('Blocked domain not found', 404);
  }

  await prisma.blockedDomain.delete({
    where: { id: domainId },
  });

  res.json({
    message: 'Blocked domain deleted successfully',
  });
}));

/**
 * Get allowed domains
 */
router.get('/allowed-domains', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { page = '1', limit = '50', search, category } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { userId, isActive: true };

  if (search) {
    where.domain = { contains: search as string, mode: 'insensitive' };
  }

  if (category) {
    where.category = category;
  }

  const [domains, total] = await Promise.all([
    prisma.allowedDomain.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.allowedDomain.count({ where }),
  ]);

  res.json({
    domains: domains.map(domain => AllowedDomainSchema.parse(domain)),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}));

/**
 * Add an allowed domain
 */
router.post('/allowed-domains', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { domain, category } = CreateAllowedDomainSchema.parse(req.body);

  // Validate domain format
  if (!isValidDomain(domain)) {
    throw new AppError('Invalid domain format', 400);
  }

  // Check if domain already exists
  const existingDomain = await prisma.allowedDomain.findFirst({
    where: {
      userId,
      domain: domain.toLowerCase(),
    },
  });

  if (existingDomain) {
    if (existingDomain.isActive) {
      throw new AppError('Domain is already allowed', 409);
    } else {
      // Reactivate existing domain
      const reactivatedDomain = await prisma.allowedDomain.update({
        where: { id: existingDomain.id },
        data: {
          isActive: true,
          category,
          updatedAt: new Date(),
        },
      });

      return res.status(201).json({
        message: 'Domain allowed successfully',
        domain: AllowedDomainSchema.parse(reactivatedDomain),
      });
    }
  }

  const allowedDomain = await prisma.allowedDomain.create({
    data: {
      userId,
      domain: domain.toLowerCase(),
      category,
    },
  });

  res.status(201).json({
    message: 'Domain allowed successfully',
    domain: AllowedDomainSchema.parse(allowedDomain),
  });
}));

/**
 * Update an allowed domain
 */
router.patch('/allowed-domains/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const domainId = req.params.id;
  const { category, isActive } = req.body;

  const domain = await prisma.allowedDomain.findFirst({
    where: {
      id: domainId,
      userId,
    },
  });

  if (!domain) {
    throw new AppError('Allowed domain not found', 404);
  }

  const updatedDomain = await prisma.allowedDomain.update({
    where: { id: domainId },
    data: {
      ...(category !== undefined && { category }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    },
  });

  res.json({
    message: 'Allowed domain updated successfully',
    domain: AllowedDomainSchema.parse(updatedDomain),
  });
}));

/**
 * Delete an allowed domain
 */
router.delete('/allowed-domains/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const domainId = req.params.id;

  const domain = await prisma.allowedDomain.findFirst({
    where: {
      id: domainId,
      userId,
    },
  });

  if (!domain) {
    throw new AppError('Allowed domain not found', 404);
  }

  await prisma.allowedDomain.delete({
    where: { id: domainId },
  });

  res.json({
    message: 'Allowed domain deleted successfully',
  });
}));

/**
 * Import domain lists (bulk operations)
 */
router.post('/import-domains', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { blockedDomains, allowedDomains } = req.body;

  const results = {
    blocked: { created: 0, updated: 0, errors: 0 },
    allowed: { created: 0, updated: 0, errors: 0 },
  };

  // Process blocked domains
  if (Array.isArray(blockedDomains)) {
    for (const domainData of blockedDomains) {
      try {
        const { domain, reason } = CreateBlockedDomainSchema.parse(domainData);
        
        if (!isValidDomain(domain)) {
          results.blocked.errors++;
          continue;
        }

        await prisma.blockedDomain.upsert({
          where: {
            userId_domain: {
              userId,
              domain: domain.toLowerCase(),
            },
          },
          update: {
            isActive: true,
            reason,
            updatedAt: new Date(),
          },
          create: {
            userId,
            domain: domain.toLowerCase(),
            reason,
          },
        });

        results.blocked.created++;
      } catch (error) {
        results.blocked.errors++;
      }
    }
  }

  // Process allowed domains
  if (Array.isArray(allowedDomains)) {
    for (const domainData of allowedDomains) {
      try {
        const { domain, category } = CreateAllowedDomainSchema.parse(domainData);
        
        if (!isValidDomain(domain)) {
          results.allowed.errors++;
          continue;
        }

        await prisma.allowedDomain.upsert({
          where: {
            userId_domain: {
              userId,
              domain: domain.toLowerCase(),
            },
          },
          update: {
            isActive: true,
            category,
            updatedAt: new Date(),
          },
          create: {
            userId,
            domain: domain.toLowerCase(),
            category,
          },
        });

        results.allowed.created++;
      } catch (error) {
        results.allowed.errors++;
      }
    }
  }

  res.json({
    message: 'Domain import completed',
    results,
  });
}));

/**
 * Export domain lists
 */
router.get('/export-domains', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const [blockedDomains, allowedDomains] = await Promise.all([
    prisma.blockedDomain.findMany({
      where: { userId, isActive: true },
      orderBy: { domain: 'asc' },
    }),
    prisma.allowedDomain.findMany({
      where: { userId, isActive: true },
      orderBy: { domain: 'asc' },
    }),
  ]);

  res.json({
    blockedDomains: blockedDomains.map(domain => ({
      domain: domain.domain,
      reason: domain.reason,
      createdAt: domain.createdAt,
    })),
    allowedDomains: allowedDomains.map(domain => ({
      domain: domain.domain,
      category: domain.category,
      createdAt: domain.createdAt,
    })),
    exportedAt: new Date().toISOString(),
  });
}));

export default router;
