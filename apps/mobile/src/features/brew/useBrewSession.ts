import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useCreateTimer } from '@/lib/api/hooks/useCreateTimer';
import { useDeleteTimer } from '@/lib/api/hooks/useDeleteTimer';
import { usePauseTimer } from '@/lib/api/hooks/usePauseTimer';
import { useResumeTimer } from '@/lib/api/hooks/useResumeTimer';
import { useTimerPoll } from '@/lib/api/hooks/useTimerPoll';
import type { RecipeStep, TimerStatus } from '@/lib/api/types';

export interface BrewSession {
  currentStep: RecipeStep | null;
  nextStep: RecipeStep | null;
  stepIndex: number;
  totalSteps: number;
  displaySeconds: number | null;
  timerStatus: TimerStatus | null;
  sessionComplete: boolean;
  pause: () => void;
  resume: () => void;
  advance: () => void;
  exit: () => void;
}

/**
 * Owns the brew session state machine: which step we're on, the active
 * server-backed timer (if the step has a duration), and auto-advance when
 * that timer finishes. Steps with durationSeconds:null never get a timer —
 * the caller shows a manual "mark done" affordance instead.
 */
export function useBrewSession(recipeId: string, steps: RecipeStep[]): BrewSession {
  const [stepIndex, setStepIndex] = useState(0);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);

  const queryClient = useQueryClient();
  const createTimerMutation = useCreateTimer();
  const pauseTimerMutation = usePauseTimer();
  const resumeTimerMutation = useResumeTimer();
  const deleteTimerMutation = useDeleteTimer();
  const poll = useTimerPoll(activeTimerId);

  const currentStep = steps[stepIndex] ?? null;
  const nextStep = steps[stepIndex + 1] ?? null;
  const timerStatus = poll.data?.status ?? null;

  // Entering a new step: create a timer if it has a duration, otherwise
  // leave activeTimerId null so the UI falls back to manual advance.
  useEffect(() => {
    if (sessionComplete) return;
    const step = steps[stepIndex];
    if (!step) return;

    setDisplaySeconds(null);

    if (step.durationSeconds != null) {
      createTimerMutation.mutate(
        {
          label: step.description.slice(0, 64),
          durationSeconds: step.durationSeconds,
          recipeId,
          stepNumber: step.stepNumber,
        },
        {
          onSuccess: (timer) => {
            setActiveTimerId(timer.id);
            setDisplaySeconds(timer.remainingSeconds);
          },
        },
      );
    } else {
      setActiveTimerId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, sessionComplete]);

  // Realign local display to server truth every time a poll resolves.
  useEffect(() => {
    if (poll.data) {
      setDisplaySeconds(poll.data.remainingSeconds);
    }
  }, [poll.data]);

  // Local 1s ticking between polls, so the number moves smoothly.
  useEffect(() => {
    if (timerStatus !== 'running') return;
    const id = setInterval(() => {
      setDisplaySeconds((s) => (s != null && s > 0 ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
  }, [timerStatus, activeTimerId]);

  const advance = useCallback(() => {
    if (activeTimerId) {
      deleteTimerMutation.mutate(activeTimerId);
    }
    setActiveTimerId(null);
    setDisplaySeconds(null);
    const next = stepIndex + 1;
    if (next >= steps.length) {
      setSessionComplete(true);
    } else {
      setStepIndex(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimerId, deleteTimerMutation, stepIndex, steps.length]);

  // Auto-advance is the same code path as the manual button — just
  // triggered by the server reporting the timer finished.
  useEffect(() => {
    if (timerStatus === 'finished') {
      advance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus]);

  // pause/resume mutations return the fresh TimerView but don't touch the
  // poll query's cache — without writing it in here, the button/countdown
  // would show stale state until the next 12s poll cycle catches up.
  const pause = useCallback(() => {
    if (!activeTimerId) return;
    pauseTimerMutation.mutate(activeTimerId, {
      onSuccess: (timer) => queryClient.setQueryData(['timer', activeTimerId], timer),
    });
  }, [activeTimerId, pauseTimerMutation, queryClient]);

  const resume = useCallback(() => {
    if (!activeTimerId) return;
    resumeTimerMutation.mutate(activeTimerId, {
      onSuccess: (timer) => queryClient.setQueryData(['timer', activeTimerId], timer),
    });
  }, [activeTimerId, resumeTimerMutation, queryClient]);

  const exit = useCallback(() => {
    if (activeTimerId) {
      deleteTimerMutation.mutate(activeTimerId);
    }
  }, [activeTimerId, deleteTimerMutation]);

  return {
    currentStep,
    nextStep,
    stepIndex,
    totalSteps: steps.length,
    displaySeconds,
    timerStatus,
    sessionComplete,
    pause,
    resume,
    advance,
    exit,
  };
}
