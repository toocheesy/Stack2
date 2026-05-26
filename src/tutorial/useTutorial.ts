import { useCallback, useState } from 'react';
import { setTutorialSeen } from './tutorialStorage';

export interface TutorialApi {
  visible: boolean;
  currentStep: number;
  totalSteps: number;
  open(): void;
  dismiss(): void;
  complete(): void;
  next(): void;
  prev(): void;
  jumpTo(step: number): void;
}

export function useTutorial(totalSteps: number, initialVisible = false): TutorialApi {
  // initialVisible: lets the caller (GameWrapper) start the overlay open
  // synchronously on first W1L1 entry. Avoids the effect round-trip that
  // would let useGameController's mount fire a bot turn before the overlay
  // visually opens (effect-ordering race fixed by the freeze track).
  const [visible, setVisible] = useState(initialVisible);
  const [currentStep, setStep] = useState(0);

  const open = useCallback(() => {
    setStep(0);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setTutorialSeen(true);
    setVisible(false);
    setStep(0);
  }, []);

  const dismiss = useCallback(() => close(), [close]);
  const complete = useCallback(() => close(), [close]);

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= totalSteps - 1) {
        close();
        return 0;
      }
      return s + 1;
    });
  }, [totalSteps, close]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const jumpTo = useCallback(
    (step: number) => {
      setStep(Math.max(0, Math.min(totalSteps - 1, step)));
    },
    [totalSteps],
  );

  return { visible, currentStep, totalSteps, open, dismiss, complete, next, prev, jumpTo };
}
