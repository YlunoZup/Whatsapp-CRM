import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Session Health Score Calculation
 *
 * Based on WhatsApp best practices and research:
 * - Account age matters: First 10 days are highest risk
 * - Message volume: 100-200 msgs/day is safe for established accounts
 * - New contacts: Max 20/day for new accounts, 50/day for established
 * - Reply rate: 50%+ is healthy (replies vs messages sent)
 * - Error rate: Low is good
 * - Rest periods: Sessions need breaks
 *
 * Health Score Formula (0-100):
 * - Account Age Factor: 0-20 points
 * - Message Volume Factor: 0-25 points
 * - New Contacts Factor: 0-20 points
 * - Reply Rate Factor: 0-20 points
 * - Error Rate Factor: 0-15 points
 */

export interface SessionHealthMetrics {
  // Raw metrics
  sessionId: string;
  accountAgeDays: number;
  messagesToday: number;
  messagesThisHour: number;
  newContactsToday: number;
  totalOutbound: number;
  totalInbound: number;
  replyRate: number; // percentage
  errorCountToday: number;
  warningCountToday: number;
  lastActivityMinutesAgo: number;
  isConnected: boolean;

  // Calculated health score
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'warning' | 'critical';

  // Factor breakdowns
  factors: {
    accountAge: { score: number; max: number; detail: string };
    messageVolume: { score: number; max: number; detail: string };
    newContacts: { score: number; max: number; detail: string };
    replyRate: { score: number; max: number; detail: string };
    errorRate: { score: number; max: number; detail: string };
  };

  // Recommendations
  recommendations: string[];

  // Limits based on account age
  limits: {
    maxMessagesPerDay: number;
    maxNewContactsPerDay: number;
    maxMessagesPerHour: number;
    recommendedRestHours: number;
  };
}

@Injectable()
export class SessionHealthService {
  private readonly logger = new Logger(SessionHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate health metrics for a session
   */
  async getSessionHealth(sessionId: string, tenantId: string): Promise<SessionHealthMetrics> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get session info
    const session = await this.prisma.whatsappSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        _count: {
          select: { assignedContacts: true }
        }
      }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Calculate account age
    const accountAgeDays = Math.floor(
      (now.getTime() - new Date(session.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get message counts for today
    const [messagesToday, messagesThisHour] = await Promise.all([
      this.prisma.message.count({
        where: {
          tenantId,
          conversation: { sessionId },
          direction: 'outbound',
          createdAt: { gte: startOfDay }
        }
      }),
      this.prisma.message.count({
        where: {
          tenantId,
          conversation: { sessionId },
          direction: 'outbound',
          createdAt: { gte: oneHourAgo }
        }
      })
    ]);

    // Get new contacts today (contacts whose conversation was created today)
    const newContactsToday = await this.prisma.conversation.count({
      where: {
        sessionId,
        tenantId,
        createdAt: { gte: startOfDay }
      }
    });

    // Get total message counts for reply rate calculation (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [totalOutbound, totalInbound] = await Promise.all([
      this.prisma.message.count({
        where: {
          tenantId,
          conversation: { sessionId },
          direction: 'outbound',
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      this.prisma.message.count({
        where: {
          tenantId,
          conversation: { sessionId },
          direction: 'inbound',
          createdAt: { gte: sevenDaysAgo }
        }
      })
    ]);

    // Calculate reply rate
    const replyRate = totalOutbound > 0
      ? Math.round((totalInbound / totalOutbound) * 100)
      : 100;

    // Get error/warning counts from logs today
    const [errorCountToday, warningCountToday] = await Promise.all([
      this.prisma.sessionLog.count({
        where: {
          sessionId,
          level: 'error',
          createdAt: { gte: startOfDay }
        }
      }),
      this.prisma.sessionLog.count({
        where: {
          sessionId,
          level: 'warning',
          createdAt: { gte: startOfDay }
        }
      })
    ]);

    // Get last activity
    const lastMessage = await this.prisma.message.findFirst({
      where: {
        tenantId,
        conversation: { sessionId }
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const lastActivityMinutesAgo = lastMessage
      ? Math.floor((now.getTime() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60))
      : 999;

    // Determine limits based on account age
    const limits = this.getLimitsForAccountAge(accountAgeDays);

    // Calculate health factors
    const factors = this.calculateHealthFactors({
      accountAgeDays,
      messagesToday,
      messagesThisHour,
      newContactsToday,
      replyRate,
      errorCountToday,
      warningCountToday,
      limits
    });

    // Calculate total health score
    const healthScore = Object.values(factors).reduce((sum, f) => sum + f.score, 0);

    // Determine health status
    const healthStatus = this.getHealthStatus(healthScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      accountAgeDays,
      messagesToday,
      newContactsToday,
      replyRate,
      errorCountToday,
      healthScore,
      limits
    });

    return {
      sessionId,
      accountAgeDays,
      messagesToday,
      messagesThisHour,
      newContactsToday,
      totalOutbound,
      totalInbound,
      replyRate,
      errorCountToday,
      warningCountToday,
      lastActivityMinutesAgo,
      isConnected: session.status === 'connected',
      healthScore,
      healthStatus,
      factors,
      recommendations,
      limits
    };
  }

  /**
   * Get safe limits based on account age
   */
  private getLimitsForAccountAge(ageDays: number): SessionHealthMetrics['limits'] {
    if (ageDays < 3) {
      // Very new account - very conservative
      return {
        maxMessagesPerDay: 50,
        maxNewContactsPerDay: 10,
        maxMessagesPerHour: 10,
        recommendedRestHours: 12
      };
    } else if (ageDays < 7) {
      // New account - conservative
      return {
        maxMessagesPerDay: 100,
        maxNewContactsPerDay: 20,
        maxMessagesPerHour: 20,
        recommendedRestHours: 8
      };
    } else if (ageDays < 14) {
      // Warming up - moderate
      return {
        maxMessagesPerDay: 150,
        maxNewContactsPerDay: 30,
        maxMessagesPerHour: 30,
        recommendedRestHours: 6
      };
    } else if (ageDays < 30) {
      // Established - normal
      return {
        maxMessagesPerDay: 200,
        maxNewContactsPerDay: 50,
        maxMessagesPerHour: 40,
        recommendedRestHours: 4
      };
    } else {
      // Mature account - full capacity
      return {
        maxMessagesPerDay: 300,
        maxNewContactsPerDay: 75,
        maxMessagesPerHour: 50,
        recommendedRestHours: 4
      };
    }
  }

  /**
   * Calculate individual health factors
   */
  private calculateHealthFactors(data: {
    accountAgeDays: number;
    messagesToday: number;
    messagesThisHour: number;
    newContactsToday: number;
    replyRate: number;
    errorCountToday: number;
    warningCountToday: number;
    limits: SessionHealthMetrics['limits'];
  }): SessionHealthMetrics['factors'] {
    const { accountAgeDays, messagesToday, newContactsToday, replyRate, errorCountToday, warningCountToday, limits } = data;

    // Account Age Factor (0-20 points)
    // Older accounts are more trusted
    let ageScore = 0;
    let ageDetail = '';
    if (accountAgeDays < 3) {
      ageScore = 5;
      ageDetail = 'Very new account - high risk period';
    } else if (accountAgeDays < 7) {
      ageScore = 10;
      ageDetail = 'New account - warming up';
    } else if (accountAgeDays < 14) {
      ageScore = 15;
      ageDetail = 'Account maturing';
    } else {
      ageScore = 20;
      ageDetail = 'Established account';
    }

    // Message Volume Factor (0-25 points)
    // Staying under daily limit is good
    const messageUsagePercent = (messagesToday / limits.maxMessagesPerDay) * 100;
    let volumeScore = 0;
    let volumeDetail = '';
    if (messageUsagePercent < 50) {
      volumeScore = 25;
      volumeDetail = `${Math.round(messageUsagePercent)}% of daily limit used`;
    } else if (messageUsagePercent < 75) {
      volumeScore = 20;
      volumeDetail = `${Math.round(messageUsagePercent)}% of daily limit used`;
    } else if (messageUsagePercent < 90) {
      volumeScore = 12;
      volumeDetail = `${Math.round(messageUsagePercent)}% of daily limit - consider slowing down`;
    } else if (messageUsagePercent < 100) {
      volumeScore = 5;
      volumeDetail = `${Math.round(messageUsagePercent)}% of daily limit - near capacity`;
    } else {
      volumeScore = 0;
      volumeDetail = `Exceeded daily limit (${messagesToday}/${limits.maxMessagesPerDay})`;
    }

    // New Contacts Factor (0-20 points)
    // Cold outreach is riskier
    const contactUsagePercent = (newContactsToday / limits.maxNewContactsPerDay) * 100;
    let contactScore = 0;
    let contactDetail = '';
    if (contactUsagePercent < 50) {
      contactScore = 20;
      contactDetail = `${newContactsToday} new contacts today (safe)`;
    } else if (contactUsagePercent < 75) {
      contactScore = 15;
      contactDetail = `${newContactsToday} new contacts today (moderate)`;
    } else if (contactUsagePercent < 100) {
      contactScore = 8;
      contactDetail = `${newContactsToday} new contacts today (approaching limit)`;
    } else {
      contactScore = 0;
      contactDetail = `Exceeded new contact limit (${newContactsToday}/${limits.maxNewContactsPerDay})`;
    }

    // Reply Rate Factor (0-20 points)
    // Higher reply rate = healthier account
    let replyScore = 0;
    let replyDetail = '';
    if (replyRate >= 50) {
      replyScore = 20;
      replyDetail = `${replyRate}% reply rate (excellent)`;
    } else if (replyRate >= 30) {
      replyScore = 15;
      replyDetail = `${replyRate}% reply rate (good)`;
    } else if (replyRate >= 15) {
      replyScore = 10;
      replyDetail = `${replyRate}% reply rate (needs improvement)`;
    } else if (replyRate >= 5) {
      replyScore = 5;
      replyDetail = `${replyRate}% reply rate (low - risk of being flagged)`;
    } else {
      replyScore = 0;
      replyDetail = `${replyRate}% reply rate (very low - high risk)`;
    }

    // Error Rate Factor (0-15 points)
    // Fewer errors = healthier
    let errorScore = 0;
    let errorDetail = '';
    const totalIssues = errorCountToday + warningCountToday;
    if (totalIssues === 0) {
      errorScore = 15;
      errorDetail = 'No errors or warnings today';
    } else if (totalIssues <= 3) {
      errorScore = 12;
      errorDetail = `${totalIssues} issues today (minor)`;
    } else if (totalIssues <= 10) {
      errorScore = 8;
      errorDetail = `${totalIssues} issues today (moderate)`;
    } else if (totalIssues <= 20) {
      errorScore = 4;
      errorDetail = `${totalIssues} issues today (concerning)`;
    } else {
      errorScore = 0;
      errorDetail = `${totalIssues} issues today (critical)`;
    }

    return {
      accountAge: { score: ageScore, max: 20, detail: ageDetail },
      messageVolume: { score: volumeScore, max: 25, detail: volumeDetail },
      newContacts: { score: contactScore, max: 20, detail: contactDetail },
      replyRate: { score: replyScore, max: 20, detail: replyDetail },
      errorRate: { score: errorScore, max: 15, detail: errorDetail }
    };
  }

  /**
   * Get health status from score
   */
  private getHealthStatus(score: number): SessionHealthMetrics['healthStatus'] {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'warning';
    return 'critical';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(data: {
    accountAgeDays: number;
    messagesToday: number;
    newContactsToday: number;
    replyRate: number;
    errorCountToday: number;
    healthScore: number;
    limits: SessionHealthMetrics['limits'];
  }): string[] {
    const recommendations: string[] = [];

    // Account age recommendations
    if (data.accountAgeDays < 7) {
      recommendations.push('Account is new. Keep message volume low and avoid cold outreach to build trust.');
    }

    // Message volume recommendations
    const messageUsagePercent = (data.messagesToday / data.limits.maxMessagesPerDay) * 100;
    if (messageUsagePercent >= 90) {
      recommendations.push('Near daily message limit. Consider pausing outreach until tomorrow.');
    } else if (messageUsagePercent >= 75) {
      recommendations.push('Over 75% of daily limit used. Slow down to preserve account health.');
    }

    // New contacts recommendations
    const contactUsagePercent = (data.newContactsToday / data.limits.maxNewContactsPerDay) * 100;
    if (contactUsagePercent >= 90) {
      recommendations.push('Near daily new contact limit. Focus on existing conversations.');
    }

    // Reply rate recommendations
    if (data.replyRate < 30) {
      recommendations.push('Low reply rate may trigger spam detection. Improve message quality and targeting.');
    } else if (data.replyRate < 50) {
      recommendations.push('Reply rate below target (50%). Consider more engaging message templates.');
    }

    // Error recommendations
    if (data.errorCountToday > 5) {
      recommendations.push('Multiple errors detected. Check session logs for issues.');
    }

    // General health recommendations
    if (data.healthScore < 50) {
      recommendations.push('Session health is low. Consider resting this session for a few hours.');
    }

    // If no issues, give positive feedback
    if (recommendations.length === 0) {
      recommendations.push('Session is healthy. Continue with normal activity.');
    }

    return recommendations;
  }
}
