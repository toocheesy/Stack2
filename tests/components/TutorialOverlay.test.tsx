// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TutorialOverlay, type TutorialMark } from '../../src/components/TutorialOverlay';

const noop = () => {};

function markOnRealElement(): TutorialMark {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return { title: 'Your hand', copy: 'Tap a card.', ref: { current: el } };
}

// The blocking layer: fixed, full-screen, zIndex 400, pointerEvents auto.
function findBlockingLayer(root: ParentNode): HTMLElement | null {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('div'))) {
    const s = el.style;
    if (
      s.position === 'fixed' &&
      s.zIndex === '400' &&
      s.pointerEvents === 'auto' &&
      s.inset === '0px'
    ) {
      return el;
    }
  }
  return null;
}

describe('TutorialOverlay', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('visible: a fixed, full-screen layer with zIndex 400 and pointerEvents auto is in the page', () => {
    const { baseElement } = render(
      <TutorialOverlay
        visible
        currentStep={0}
        totalSteps={1}
        marks={[markOnRealElement()]}
        onNext={noop}
        onPrev={noop}
        onSkip={noop}
        onJump={noop}
      />,
    );
    expect(findBlockingLayer(baseElement)).not.toBeNull();
  });

  it('not visible: that layer is not there', () => {
    const { baseElement } = render(
      <TutorialOverlay
        visible={false}
        currentStep={0}
        totalSteps={1}
        marks={[markOnRealElement()]}
        onNext={noop}
        onPrev={noop}
        onSkip={noop}
        onJump={noop}
      />,
    );
    expect(findBlockingLayer(baseElement)).toBeNull();
  });
});
