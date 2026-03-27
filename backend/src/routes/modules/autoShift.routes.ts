import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { getBusinessDayRange } from '../../utils/businessDay.js';

export const autoShiftRouter = Router();

// Employee: auto-start shift if active but no shift exists
autoShiftRouter.post('/start-if-needed', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const employeeId = req.user!.id;
  
  try {
    // Check if employee is active
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { status: true, branchId: true, name: true }
    });
    
    if (!employee || employee.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Employee account is not active' });
    }
    
    if (!employee.branchId) {
      return res.status(400).json({ message: 'Employee has no branch assigned' });
    }
    
    // Check if already has active shift
    const existingShift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
      select: { id: true }
    });
    
    if (existingShift) {
      return res.json({ 
        message: 'Shift already active', 
        shiftStarted: false,
        shiftId: existingShift.id 
      });
    }
    
    // Check if already completed shift today
    const timeZone = process.env.TZ || 'Asia/Kolkata';
    const { dateKey: todayBusinessKey } = getBusinessDayRange({
      date: new Date(),
      boundaryHour: 4,
      timeZone,
    });
    
    const completedToday = await prisma.employeeShift.findFirst({
      where: { 
        employeeId, 
        shiftEnd: { not: null },
        shiftStart: {
          gte: new Date(new Date().setHours(4, 0, 0, 0)) // Today 4 AM
        }
      },
      select: { id: true }
    });
    
    if (completedToday) {
      return res.status(400).json({ 
        message: 'Shift already completed today. Cannot start new shift until next business day.',
        shiftStarted: false 
      });
    }
    
    // Auto-start shift
    const newShift = await prisma.employeeShift.create({
      data: {
        employeeId,
        branchId: employee.branchId,
        shiftStart: new Date(),
        status: 'ACTIVE',
        totalHours: 0,
        totalSales: 0,
        pauseCount: 0,
      },
      select: { id: true, shiftStart: true, status: true }
    });
    
    // Log the auto-start
    await prisma.errorLog.create({
      data: {
        errorType: 'AUTO_SHIFT_START',
        apiEndpoint: '/auto-shift/start-if-needed',
        errorMessage: `Auto-started shift for active employee ${employee.name} (${employeeId})`,
        branchId: employee.branchId,
        status: 'RESOLVED',
      },
    });
    
    return res.json({
      message: 'Shift auto-started successfully',
      shiftStarted: true,
      shiftId: newShift.id,
      shiftStart: newShift.shiftStart
    });
    
  } catch (error) {
    console.error('Auto-shift start error:', error);
    return res.status(500).json({ message: 'Failed to auto-start shift' });
  }
});

// Check if ordering is open (enhanced version with auto-shift option)
autoShiftRouter.get('/ordering-status', async (req, res) => {
  const { branchId } = req.query;
  
  if (!branchId || typeof branchId !== 'string') {
    return res.status(400).json({ message: 'Branch ID is required' });
  }
  
  try {
    const branchIdNum = parseInt(branchId, 10);
    if (isNaN(branchIdNum)) {
      return res.status(400).json({ message: 'Invalid branch ID' });
    }
    
    // Check for active shifts
    const activeShift = await prisma.employeeShift.findFirst({
      where: {
        branchId: branchIdNum,
        shiftEnd: null,
        status: 'ACTIVE',
        employee: { status: 'ACTIVE' },
      },
      include: {
        employee: {
          select: { name: true, email: true }
        }
      }
    });
    
    // Also check for active employees without shifts (for auto-start suggestion)
    const activeEmployeesWithoutShift = await prisma.employee.findMany({
      where: {
        branchId: branchIdNum,
        status: 'ACTIVE',
      },
      select: { id: true, name: true, email: true }
    });
    
    // Filter out employees who already have active shifts
    const employeesWithActiveShiftIds = activeShift ? [activeShift.employeeId] : [];
    const availableEmployees = activeEmployeesWithoutShift.filter(
      emp => !employeesWithActiveShiftIds.includes(emp.id)
    );
    
    return res.json({
      branchId: branchIdNum,
      orderingOpen: !!activeShift,
      activeShift: activeShift ? {
        id: activeShift.id,
        employeeId: activeShift.employeeId,
        employeeName: activeShift.employee.name
      } : null,
      activeEmployeesWithoutShift: availableEmployees,
      canAutoStart: availableEmployees.length > 0
    });
    
  } catch (error) {
    console.error('Ordering status check error:', error);
    return res.status(500).json({ message: 'Failed to check ordering status' });
  }
});
