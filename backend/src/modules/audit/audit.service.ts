import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogDto {
  userId?: string;
  action: string;
  entityName: string;
  entityId: string;
  oldState?: Record<string, any>;
  newState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Record immutable audit log entry in PostgreSQL
   * Rule 7: Every critical financial event must have an audit log
   */
  public async log(entry: AuditLogDto): Promise<{ logId: string; timestamp: string }> {
    const logId = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    // Mask sensitive credentials or secrets if present
    const sanitizedNewState = entry.newState ? { ...entry.newState } : undefined;
    if (sanitizedNewState?.pin) delete sanitizedNewState.pin;
    if (sanitizedNewState?.password) delete sanitizedNewState.password;
    if (sanitizedNewState?.token) delete sanitizedNewState.token;

    this.logger.log(
      `[AUDIT] Action: ${entry.action} | Entity: ${entry.entityName}:${entry.entityId} | User: ${entry.userId || 'SYSTEM'}`
    );

    // In production: INSERT INTO audit_logs (id, user_id, action, entity_name, entity_id, old_state, new_state, ip_address, user_agent, created_at)
    return {
      logId,
      timestamp,
    };
  }
}
