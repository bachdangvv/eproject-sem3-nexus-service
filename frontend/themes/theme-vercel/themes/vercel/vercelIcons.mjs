import { createElement } from 'react';

export const vercelIconRegistry = {
  'nexus:sidebar': createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.75,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      width: '1em',
      height: '1em',
      'aria-hidden': true,
    },
    createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2.5 }),
    createElement('line', { x1: 9, y1: 3, x2: 9, y2: 21 }),
  ),
};
