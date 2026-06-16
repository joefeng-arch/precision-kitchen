import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { CreateTimerDto } from './dto/timer.dto';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const MAX_ACTIVE_PER_USER = 8;
const TTL_SECONDS = 24 * 60 * 60;

export type TimerStatus = 'running' | 'paused' | 'finished';

interface TimerState {
  id: string;
  userId: string;
  label: string;
  durationSeconds: number;
  startedAt: number;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  status: TimerStatus;
  recipeId: string | null;
  stepNumber: number | null;
}

export interface TimerView extends TimerState {
  elapsedSeconds: number;
  remainingSeconds: number;
  serverTime: number;
}

@Injectable()
export class TimersService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private timerKey(userId: string, id: string) {
    return `timer:${userId}:${id}`;
  }
  private setKey(userId: string) {
    return `timer_list:${userId}`;
  }

  async create(userId: string, dto: CreateTimerDto): Promise<TimerView> {
    const count = await this.redis.scard(this.setKey(userId));
    if (count >= MAX_ACTIVE_PER_USER) {
      throw new ConflictException(`最多 ${MAX_ACTIVE_PER_USER} 个计时器同时运行`);
    }

    const state: TimerState = {
      id: uuidv4(),
      userId,
      label: dto.label,
      durationSeconds: dto.durationSeconds,
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPauseMs: 0,
      status: 'running',
      recipeId: dto.recipeId ?? null,
      stepNumber: dto.stepNumber ?? null,
    };

    await this.save(state);
    return this.toView(state);
  }

  async list(userId: string): Promise<TimerView[]> {
    const ids = await this.redis.smembers(this.setKey(userId));
    if (!ids.length) return [];
    const states = await Promise.all(ids.map((id) => this.read(userId, id)));
    return states.filter((s): s is TimerState => s !== null).map((s) => this.toView(s));
  }

  async findOne(userId: string, id: string): Promise<TimerView> {
    const state = await this.read(userId, id);
    if (!state) throw new NotFoundException('Timer not found or expired');
    return this.toView(state);
  }

  async pause(userId: string, id: string): Promise<TimerView> {
    const state = await this.mustRead(userId, id);
    if (state.status !== 'running') {
      throw new BadRequestException(`无法暂停：当前状态 ${state.status}`);
    }
    state.pausedAt = Date.now();
    state.status = 'paused';
    await this.save(state);
    return this.toView(state);
  }

  async resume(userId: string, id: string): Promise<TimerView> {
    const state = await this.mustRead(userId, id);
    if (state.status !== 'paused') {
      throw new BadRequestException(`无法恢复：当前状态 ${state.status}`);
    }
    if (state.pausedAt !== null) {
      state.accumulatedPauseMs += Date.now() - state.pausedAt;
    }
    state.pausedAt = null;
    state.status = 'running';
    await this.save(state);
    return this.toView(state);
  }

  async reset(userId: string, id: string): Promise<TimerView> {
    const state = await this.mustRead(userId, id);
    state.startedAt = Date.now();
    state.pausedAt = null;
    state.accumulatedPauseMs = 0;
    state.status = 'running';
    await this.save(state);
    return this.toView(state);
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    const exists = await this.redis.exists(this.timerKey(userId, id));
    if (!exists) throw new NotFoundException('Timer not found');
    await this.redis.del(this.timerKey(userId, id));
    await this.redis.srem(this.setKey(userId), id);
    return { id };
  }

  // -------- private --------

  private async save(state: TimerState): Promise<void> {
    const key = this.timerKey(state.userId, state.id);
    await this.redis.set(key, JSON.stringify(state), 'EX', TTL_SECONDS);
    await this.redis.sadd(this.setKey(state.userId), state.id);
    await this.redis.expire(this.setKey(state.userId), TTL_SECONDS);
  }

  private async read(userId: string, id: string): Promise<TimerState | null> {
    const raw = await this.redis.get(this.timerKey(userId, id));
    if (!raw) {
      await this.redis.srem(this.setKey(userId), id);
      return null;
    }
    return JSON.parse(raw) as TimerState;
  }

  private async mustRead(userId: string, id: string): Promise<TimerState> {
    const s = await this.read(userId, id);
    if (!s) throw new NotFoundException('Timer not found or expired');
    return s;
  }

  private toView(state: TimerState): TimerView {
    const now = Date.now();
    let pausedDelta = state.accumulatedPauseMs;
    if (state.status === 'paused' && state.pausedAt !== null) {
      pausedDelta += now - state.pausedAt;
    }
    const elapsedMs = now - state.startedAt - pausedDelta;
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const remainingSeconds = Math.max(0, state.durationSeconds - elapsedSeconds);
    const status: TimerStatus =
      state.status === 'paused'
        ? 'paused'
        : remainingSeconds === 0
        ? 'finished'
        : 'running';
    return { ...state, status, elapsedSeconds, remainingSeconds, serverTime: now };
  }
}
