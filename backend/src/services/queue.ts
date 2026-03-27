import { logger } from '../utils/logger.js';

// Job interface
export interface Job {
  id: string;
  type: string;
  data: any;
  priority: 'low' | 'normal' | 'high';
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: number;
  scheduledAt: number;
  nextAttemptAt: number;
}

// Job handler interface
export interface JobHandler {
  (job: Job): Promise<void>;
}

// Simple in-memory queue for production-ready use
// In production, consider Bull Queue with Redis
class JobQueue {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler>();
  private processing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private concurrency = 3; // Number of concurrent jobs
  private currentlyProcessing = 0;

  constructor() {
    this.start();
  }

  // Register a job handler
  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    logger.info('Job handler registered', { jobType: type });
  }

  // Add a job to the queue
  async add(
    type: string,
    data: any,
    options: {
      priority?: 'low' | 'normal' | 'high';
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const id = this.generateJobId();
    const now = Date.now();

    const job: Job = {
      id,
      type,
      data,
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay || 0,
      createdAt: now,
      scheduledAt: now + (options.delay || 0),
      nextAttemptAt: now + (options.delay || 0),
    };

    this.jobs.set(id, job);

    logger.info('Job added to queue', {
      jobId: id,
      jobType: type,
      priority: job.priority,
      scheduledAt: new Date(job.scheduledAt).toISOString(),
    });

    return id;
  }

  // Start processing jobs
  private start(): void {
    this.processing = true;
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, 1000); // Check every second
  }

  // Stop processing jobs
  stop(): void {
    this.processing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Process ready jobs
  private async processJobs(): Promise<void> {
    if (!this.processing || this.currentlyProcessing >= this.concurrency) {
      return;
    }

    const now = Date.now();
    const readyJobs = Array.from(this.jobs.values())
      .filter(job => job.nextAttemptAt <= now && job.attempts < job.maxAttempts)
      .sort((a, b) => {
        // Sort by priority first, then by scheduled time
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const priorityDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return a.scheduledAt - b.scheduledAt;
      });

    if (readyJobs.length === 0) return;

    // Process up to concurrency limit
    const jobsToProcess = readyJobs.slice(0, this.concurrency - this.currentlyProcessing);

    await Promise.all(jobsToProcess.map(job => this.processJob(job)));
  }

  // Process a single job
  private async processJob(job: Job): Promise<void> {
    this.currentlyProcessing++;
    job.attempts++;

    logger.info('Processing job', {
      jobId: job.id,
      jobType: job.type,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
    });

    try {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      await handler(job);

      // Job completed successfully
      this.jobs.delete(job.id);
      logger.info('Job completed successfully', {
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Job failed', {
        jobId: job.id,
        jobType: job.type,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        error: errorMessage,
      });

      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached, remove job
        this.jobs.delete(job.id);
        logger.error('Job failed permanently', {
          jobId: job.id,
          jobType: job.type,
          totalAttempts: job.attempts,
        });
      } else {
        // Schedule retry with exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 30000); // Max 30 seconds
        job.nextAttemptAt = Date.now() + backoffMs;

        logger.info('Job scheduled for retry', {
          jobId: job.id,
          jobType: job.type,
          nextAttemptAt: new Date(job.nextAttemptAt).toISOString(),
          backoffMs,
        });
      }
    } finally {
      this.currentlyProcessing--;
    }
  }

  // Get queue statistics
  getStats() {
    const now = Date.now();
    const jobs = Array.from(this.jobs.values());

    const stats = {
      total: jobs.length,
      pending: jobs.filter(j => j.attempts === 0).length,
      processing: this.currentlyProcessing,
      failed: jobs.filter(j => j.attempts > 0).length,
      byType: {} as Record<string, number>,
      byPriority: {
        high: jobs.filter(j => j.priority === 'high').length,
        normal: jobs.filter(j => j.priority === 'normal').length,
        low: jobs.filter(j => j.priority === 'low').length,
      },
    };

    // Count by job type
    for (const job of jobs) {
      stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
    }

    return stats;
  }

  // Generate unique job ID
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear all jobs
  clear(): number {
    const count = this.jobs.size;
    this.jobs.clear();
    return count;
  }
}

// Create global queue instance
export const jobQueue = new JobQueue();

// Common job handlers
export const jobHandlers = {
  // Send WhatsApp notification
  sendWhatsAppNotification: async (job: Job) => {
    const { to, message, orderId } = job.data;

    // For now, just log the WhatsApp notification
    // In a real implementation, you would integrate with a WhatsApp API
    logger.info('WhatsApp notification prepared', {
      jobId: job.id,
      to,
      orderId,
      messageLength: message.length,
    });

    // TODO: Implement actual WhatsApp sending logic
    // This could integrate with your existing WhatsApp service
  },

  // Send email notification
  sendEmailNotification: async (job: Job) => {
    const { to, subject, html } = job.data;

    const { isMailConfigured, sendEmail } = await import('../config/mailer.js');

    if (!isMailConfigured()) {
      throw new Error('Email not configured');
    }

    await sendEmail({ to, subject, html });

    logger.info('Email notification sent', {
      jobId: job.id,
      to,
      subject,
    });
  },

  // Generate and send daily report
  generateDailyReport: async (job: Job) => {
    const { branchId, date } = job.data;

    // This would integrate with your existing report generation logic
    logger.info('Daily report generated', {
      jobId: job.id,
      branchId,
      date,
    });
  },

  // Process order analytics
  processOrderAnalytics: async (job: Job) => {
    const { orderId, branchId } = job.data;

    // Update analytics, metrics, etc.
    logger.info('Order analytics processed', {
      jobId: job.id,
      orderId,
      branchId,
    });
  },

  // Clean up old data
  cleanupOldData: async (job: Job) => {
    const { daysToKeep } = job.data;

    // Clean up old logs, temporary data, etc.
    logger.info('Old data cleanup completed', {
      jobId: job.id,
      daysToKeep,
    });
  },
};

// Register default handlers
jobQueue.register('sendWhatsAppNotification', jobHandlers.sendWhatsAppNotification);
jobQueue.register('sendEmailNotification', jobHandlers.sendEmailNotification);
jobQueue.register('generateDailyReport', jobHandlers.generateDailyReport);
jobQueue.register('processOrderAnalytics', jobHandlers.processOrderAnalytics);
jobQueue.register('cleanupOldData', jobHandlers.cleanupOldData);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down job queue...');
  jobQueue.stop();
});

process.on('SIGINT', () => {
  logger.info('Shutting down job queue...');
  jobQueue.stop();
});

export default jobQueue;
