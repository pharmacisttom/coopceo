import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  getDel(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy, IRedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // Resilient in-memory fallback for local unit tests without Redis daemon
  private memoryStore = new Map<string, { value: string; expiresAt?: number }>();

  async onModuleInit() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD;

    try {
      this.client = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    } catch (err: any) {
      this.logger.warn(`Redis connection failed (${err.message}). Falling back to atomic memory storage.`);
      this.isConnected = false;
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      this.logger.log('Redis client disconnected.');
    }
  }

  public async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      return this.client.get(key);
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  public async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    if (this.isConnected && this.client) {
      if (mode === 'EX' && duration) {
        return this.client.set(key, value, 'EX', duration);
      }
      return this.client.set(key, value);
    }

    const expiresAt = mode === 'EX' && duration ? Date.now() + duration * 1000 : undefined;
    this.memoryStore.set(key, { value, expiresAt });
    return 'OK';
  }

  public async del(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.del(key);
    }
    const existed = this.memoryStore.delete(key);
    return existed ? 1 : 0;
  }

  /**
   * Phase 2 & 3: Atomic Get-and-Delete for one-time challenge consumption (Replay Protection)
   */
  public async getDel(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      // In Redis >= 6.2, GETDEL is native
      try {
        return await (this.client as any).getdel(key);
      } catch {
        // Fallback pipeline
        const [getRes] = await this.client.pipeline().get(key).del(key).exec() || [];
        return getRes ? (getRes[1] as string) : null;
      }
    }

    const item = this.memoryStore.get(key);
    if (!item) return null;
    this.memoryStore.delete(key);
    if (item.expiresAt && Date.now() > item.expiresAt) {
      return null;
    }
    return item.value;
  }

  public async incr(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.incr(key);
    }
    const existing = await this.get(key);
    const num = existing ? parseInt(existing, 10) + 1 : 1;
    await this.set(key, num.toString());
    return num;
  }

  public async expire(key: string, seconds: number): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.expire(key, seconds);
    }
    const item = this.memoryStore.get(key);
    if (!item) return 0;
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  public async ttl(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.ttl(key);
    }
    const item = this.memoryStore.get(key);
    if (!item || !item.expiresAt) return -1;
    const remainingSeconds = Math.ceil((item.expiresAt - Date.now()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : -2;
  }
}
