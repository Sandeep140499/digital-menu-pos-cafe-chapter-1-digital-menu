import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { directorRouter } from './director.routes.js';

/** Empty string → undefined so optional URLs are truly optional (logo not required). */
const optionalHttpUrl = z.preprocess(
  val => (val === '' || val === null ? undefined : val),
  z.string().url().optional()
);

const newOrderSoundPresetEnum = z.enum(['beep', 'ring', 'siren', 'chime']);

const createBranchSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  timezone: z.string().optional(),
  logoUrl: z.string().url(),
  phone: z.preprocess(
    val => (val === '' || val === null ? undefined : val),
    z.string().optional().nullable()
  ),
  googleReviewUrl: optionalHttpUrl,
  pincode: z.string().optional().nullable(),
  directorsEmail: z.string().optional().nullable(),
  showTotalAmountToCustomers: z.boolean().optional(),
  enableNewOrderRinging: z.boolean().optional(),
  newOrderSoundPreset: newOrderSoundPresetEnum.optional(),
  newOrderSoundVolume: z.number().min(0).max(1).optional(),
});

const updateBranchSchema = createBranchSchema.partial();

export const branchRouter = Router();

// Admin: list all branches
branchRouter.get('/', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const branches = await prisma.branch.findMany({
    include: {
      _count: {
        select: { employees: true, tables: true, orders: true },
      },
    },
    orderBy: { id: 'asc' },
  });
  return res.json(branches);
});

// Admin: create branch
branchRouter.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = createBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  try {
    const branch = await prisma.branch.create({
      data: parsed.data,
    });
    return res.status(201).json(branch);
  } catch (e: unknown) {
    const msg = (e as any)?.message ? String((e as any).message) : 'Failed to create branch';
    // Prisma unique violations etc. should be user-friendly.
    if (msg.includes('Unique constraint') || msg.includes('P2002')) {
      return res.status(409).json({ message: 'A branch with these details already exists.' });
    }
    return res.status(500).json({ message: msg || 'Failed to create branch' });
  }
});

// Admin: get single branch
branchRouter.get('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: {
        select: { employees: true, tables: true, orders: true },
      },
    },
  });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  return res.json(branch);
});

// Admin: update branch (directorsEmail is managed via director verify/remove; omit from free-form update or allow sync)
branchRouter.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = updateBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const id = Number(req.params.id);
  const branch = await prisma.branch.update({
    where: { id },
    data: parsed.data,
  });
  return res.json(branch);
});

// Admin: delete branch
branchRouter.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Check if branch has employees or orders
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true, tables: true, orders: true },
        },
      },
    });
    
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    if ((branch._count?.employees || 0) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete branch with active employees. Please remove all employees first.' 
      });
    }
    
    if ((branch._count?.orders || 0) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete branch with order history. Please archive orders first.' 
      });
    }
    
    await prisma.branch.delete({ where: { id } });
    return res.json({ message: 'Branch deleted successfully' });
  } catch (e: unknown) {
    const msg = (e as any)?.message ? String((e as any).message) : 'Failed to delete branch';
    return res.status(500).json({ message: msg });
  }
});

// Nested: director management (list, request-verify, request-remove)
branchRouter.use('/:id/directors', directorRouter);
