import { useEffect, useMemo, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const JADE = '#065F46';
const TAN = '#E8C577';
const BROWN = '#72571C';
const SCRIM = 'rgba(10,10,10,0.85)';

export interface TutorialMark {
  title: string;
  copy: string;
  ref: RefObject<HTMLElement | null>;
  pill?: boolean;  // round outline for SUBMIT/RESET (default false → 8px radius)
}

interface Props {
  visible: boolean;
  currentStep: number;
  totalSteps: number;
  marks: TutorialMark[];
  onNext(): void;
  onPrev(): void;
  onSkip(): void;
  onJump(step: number): void;
}

interface MeasuredRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function rectFromDom(rect: DOMRect): MeasuredRect {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

const RING_PAD = 6;

export function TutorialOverlay({
  visible, currentStep, totalSteps, marks, onNext, onPrev, onSkip, onJump,
}: Props) {
  const [rect, setRect] = useState<MeasuredRect | null>(null);
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 375,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  const [doneBeat, setDoneBeat] = useState(false);

  const activeMark = marks[currentStep];

  // Re-measure on step change + on resize/orientationchange.
  useEffect(() => {
    if (!visible || !activeMark) return;

    const measure = () => {
      const el = activeMark.ref.current;
      if (!el) {
        setRect(null);
        return;
      }
      setRect(rectFromDom(el.getBoundingClientRect()));
    };

    // Two-frame settle to catch layout shifts when ghost SUBMIT/RESET
    // first mount alongside an opening tutorial.
    measure();
    const raf1 = requestAnimationFrame(() => {
      measure();
      const raf2 = requestAnimationFrame(measure);
      (measure as unknown as { raf2: number }).raf2 = raf2;
    });

    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      measure();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [visible, currentStep, activeMark]);

  // Reset done-beat on visibility change.
  useEffect(() => {
    if (!visible) setDoneBeat(false);
  }, [visible]);

  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep && !doneBeat) {
      setDoneBeat(true);
      setTimeout(() => onNext(), 1000);
      return;
    }
    if (doneBeat) return;
    onNext();
  };

  const cardPlacement = useMemo(() => {
    if (!rect) return null;
    const cardWidth = Math.min(320, viewport.w - 32);
    const zoneCenterY = rect.top + rect.height / 2;
    const placeBelow = zoneCenterY < viewport.h / 2;
    const horizontalGap = 12;
    const cardLeft = Math.max(
      16,
      Math.min(viewport.w - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2),
    );
    if (placeBelow) {
      return {
        left: cardLeft,
        top: rect.top + rect.height + horizontalGap,
        bottom: undefined,
        width: cardWidth,
      };
    }
    return {
      left: cardLeft,
      top: undefined,
      bottom: viewport.h - rect.top + horizontalGap,
      width: cardWidth,
    };
  }, [rect, viewport]);

  if (!activeMark) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 400, pointerEvents: 'auto',
          }}
        >
          {/* Spotlight: cutout div with huge box-shadow projecting the scrim outward. */}
          {rect && (
            <div
              style={{
                position: 'fixed',
                top: rect.top - RING_PAD,
                left: rect.left - RING_PAD,
                width: rect.width + RING_PAD * 2,
                height: rect.height + RING_PAD * 2,
                borderRadius: activeMark.pill ? 999 : 10,
                boxShadow: `0 0 0 9999px ${SCRIM}`,
                outline: `2px solid ${TAN}`,
                outlineOffset: 0,
                pointerEvents: 'none',
                transition: 'top 0.22s ease, left 0.22s ease, width 0.22s ease, height 0.22s ease',
              }}
            />
          )}
          {/* If no rect (ref not mounted), full-screen scrim only. */}
          {!rect && (
            <div style={{ position: 'fixed', inset: 0, background: SCRIM, pointerEvents: 'auto' }} />
          )}

          {/* Coach card */}
          {cardPlacement && !doneBeat && (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'fixed',
                left: cardPlacement.left,
                top: cardPlacement.top,
                bottom: cardPlacement.bottom,
                width: cardPlacement.width,
                background: '#1a1a1a',
                borderRadius: 10,
                borderTop: `3px solid ${TAN}`,
                border: `1px solid rgba(232,197,119,0.25)`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                padding: 18,
                display: 'flex', flexDirection: 'column', gap: 12,
                pointerEvents: 'auto',
              }}
            >
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
                color: JADE, letterSpacing: '0.2em', textTransform: 'uppercase',
              }}>
                Step {currentStep + 1} of {totalSteps}
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16,
                color: '#fff', lineHeight: 1.2,
              }}>
                {activeMark.title}
              </div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.4,
                color: 'rgba(255,255,255,0.75)',
              }}>
                {activeMark.copy}
              </div>
              {/* Step dots */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 2 }}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onJump(i)}
                    aria-label={`Jump to step ${i + 1}`}
                    style={{
                      width: i === currentStep ? 8 : 6,
                      height: i === currentStep ? 8 : 6,
                      borderRadius: 99, padding: 0,
                      border: i === currentStep ? 'none' : `1px solid ${JADE}`,
                      background: i === currentStep ? TAN : 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              {/* Skip + Next/Done */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button
                  onClick={onSkip}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)', fontSize: 12,
                    fontFamily: 'Inter, sans-serif', padding: '4px 8px',
                  }}
                >
                  Skip
                </button>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {currentStep > 0 && (
                    <button
                      onClick={onPrev}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.5)', fontSize: 12,
                        fontFamily: 'Inter, sans-serif', padding: '4px 8px',
                      }}
                    >
                      Back
                    </button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNext}
                    style={{
                      background: TAN, color: BROWN, border: 'none',
                      borderRadius: 99, padding: '8px 18px',
                      fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700,
                      letterSpacing: '0.04em', cursor: 'pointer',
                    }}
                  >
                    {isLastStep ? 'Done' : 'Next'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Done-beat — brief celebratory message before auto-dismiss */}
          {doneBeat && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'fixed', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: SCRIM,
                pointerEvents: 'auto',
              }}
            >
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 800,
                color: TAN, letterSpacing: '0.04em',
              }}>
                You're ready to play
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
