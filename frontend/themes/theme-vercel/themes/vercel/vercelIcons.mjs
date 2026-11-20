import { createElement } from 'react';

const svgIcon = (...children) =>
  createElement(
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
    ...children,
  );

export const vercelIconRegistry = {
  // Existing sidebar rail toggle icon
  'nexus:sidebar': svgIcon(
    createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2.5 }),
    createElement('line', { x1: 9, y1: 3, x2: 9, y2: 21 }),
  ),

  // Admin -> Service Plans: Tiered service package podiums
  'nexus:plans': svgIcon(
    createElement('path', { d: 'M3 21h18' }),
    createElement('rect', { x: 4, y: 13, width: 4, height: 8, rx: 1 }),
    createElement('rect', { x: 10, y: 8, width: 4, height: 13, rx: 1 }),
    createElement('rect', { x: 16, y: 3, width: 4, height: 18, rx: 1 }),
  ),

  // Admin -> Products & Equipment: Isometric 3D merchandise cube box
  'nexus:products': svgIcon(
    createElement('path', {
      d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    }),
    createElement('path', { d: 'm3.3 7 8.7 5 8.7-5' }),
    createElement('line', { x1: 12, y1: 12, x2: 12, y2: 22 }),
  ),

  // Admin -> Territory Cities: Modern metropolitan skyline with skyscraper spire
  'nexus:cities': svgIcon(
    createElement('path', { d: 'M2 21h20' }),
    createElement('path', { d: 'M4 21V9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v12' }),
    createElement('path', { d: 'M10 21V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16' }),
    createElement('path', { d: 'M16 21V12a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v9' }),
    createElement('line', { x1: 13, y1: 1, x2: 13, y2: 4 }),
    createElement('line', { x1: 6, y1: 13, x2: 8, y2: 13 }),
    createElement('line', { x1: 12, y1: 9, x2: 14, y2: 9 }),
    createElement('line', { x1: 12, y1: 13, x2: 14, y2: 13 }),
    createElement('line', { x1: 18, y1: 15, x2: 19, y2: 15 }),
  ),

  // Admin -> Employees: Employee ID credential lanyard badge
  'nexus:employees': svgIcon(
    createElement('path', { d: 'M12 1v3' }),
    createElement('rect', { x: 4, y: 4, width: 16, height: 17, rx: 2.5 }),
    createElement('line', { x1: 9, y1: 7.5, x2: 15, y2: 7.5 }),
    createElement('circle', { cx: 12, cy: 12, r: 2.5 }),
    createElement('line', { x1: 8, y1: 17, x2: 16, y2: 17 }),
  ),

  // Admin & Retail -> Customers: Individual subscriber customer profile
  'nexus:customers': svgIcon(
    createElement('circle', { cx: 12, cy: 7, r: 4 }),
    createElement('path', { d: 'M5 21v-1.5a6.5 6.5 0 0 1 14 0V21' }),
  ),

  // Admin -> Retail Outlets: Retail storefront outlet with canopy awning
  'nexus:shops': svgIcon(
    createElement('path', { d: 'M3 9l2-5h14l2 5' }),
    createElement('path', { d: 'M20 9v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9' }),
    createElement('line', { x1: 3, y1: 9, x2: 21, y2: 9 }),
    createElement('line', { x1: 9, y1: 4, x2: 9, y2: 9 }),
    createElement('line', { x1: 15, y1: 4, x2: 15, y2: 9 }),
    createElement('path', { d: 'M10 21v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5' }),
  ),

  // Admin -> Vendors: Hardware & equipment supplier delivery truck
  'nexus:vendors': svgIcon(
    createElement('path', { d: 'M2 4h12a1 1 0 0 1 1 1v11H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' }),
    createElement('path', { d: 'M15 8h4.5a1.5 1.5 0 0 1 1.2.6L23 12v4a1 1 0 0 1-1 1h-7' }),
    createElement('circle', { cx: 6, cy: 18, r: 2 }),
    createElement('circle', { cx: 18, cy: 18, r: 2 }),
    createElement('line', { x1: 8, y1: 17, x2: 16, y2: 17 }),
    createElement('line', { x1: 1, y1: 17, x2: 4, y2: 17 }),
    createElement('line', { x1: 20, y1: 17, x2: 23, y2: 17 }),
  ),

  // Admin -> Equipment Purchases: Procurement cart carrying equipment crate
  'nexus:purchases': svgIcon(
    createElement('circle', { cx: 8, cy: 20, r: 1.5 }),
    createElement('circle', { cx: 18, cy: 20, r: 1.5 }),
    createElement('path', {
      d: 'M2 3h3.5l2.4 10.5a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1l1.7-6.6H6.5',
    }),
    createElement('rect', { x: 10, y: 6, width: 5, height: 4, rx: 1 }),
  ),

  // Admin & Billing -> Vendor Payments & Payment Processing: Bank card with EMV chip
  'nexus:payments': svgIcon(
    createElement('rect', { x: 2, y: 5, width: 20, height: 14, rx: 2.5 }),
    createElement('line', { x1: 2, y1: 9.5, x2: 22, y2: 9.5 }),
    createElement('rect', { x: 5, y: 13, width: 4, height: 3, rx: 0.75 }),
    createElement('circle', { cx: 17, cy: 14.5, r: 1.5 }),
  ),

  // Retail -> Service Requests: Customer support service ticket stub with notch cutouts
  'nexus:requests': svgIcon(
    createElement('path', {
      d: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z',
    }),
    createElement('line', { x1: 9, y1: 7, x2: 9, y2: 17, strokeDasharray: '1.5 2' }),
    createElement('line', { x1: 12, y1: 10, x2: 17, y2: 10 }),
    createElement('line', { x1: 12, y1: 14, x2: 15, y2: 14 }),
  ),

  // Retail & Technical -> Orders & Feedback / All Orders: Order checklist clipboard with checkmark
  'nexus:orders': svgIcon(
    createElement('rect', { x: 4, y: 4, width: 16, height: 17, rx: 2.5 }),
    createElement('path', { d: 'M9 4.5V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3v1.5' }),
    createElement('path', { d: 'm8 11.5 2 2 4.5-4.5' }),
    createElement('line', { x1: 8, y1: 16, x2: 16, y2: 16 }),
  ),

  // Retail -> Billing & Payments: Bifold finance wallet with secured clasp
  'nexus:billing': svgIcon(
    createElement('rect', { x: 2, y: 6, width: 20, height: 13, rx: 2.5 }),
    createElement('path', { d: 'M2 10h20' }),
    createElement('path', {
      d: 'M16 11.5h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z',
    }),
    createElement('circle', { cx: 18, cy: 13.5, r: 0.75 }),
  ),

  // Technical -> Feasibility Assessments: Site inspection magnifier with feasibility check
  'nexus:assessments': svgIcon(
    createElement('circle', { cx: 11, cy: 11, r: 6.5 }),
    createElement('path', { d: 'm8.5 11 2 2 3.5-3.5' }),
    createElement('line', { x1: 16, y1: 16, x2: 21, y2: 21 }),
  ),

  // Technical -> Connection Activation: Interlocking network cable link with bridge
  'nexus:connections': svgIcon(
    createElement('path', {
      d: 'M9 15l-2.5 2.5a4 4 0 0 1-5.66-5.66L3.34 9.34a4 4 0 0 1 5.66 0',
    }),
    createElement('path', {
      d: 'M15 9l2.5-2.5a4 4 0 0 1 5.66 5.66l-2.5 2.5a4 4 0 0 1-5.66 0',
    }),
    createElement('line', { x1: 9.5, y1: 14.5, x2: 14.5, y2: 9.5 }),
  ),

  // Technical -> Equipment & Maintenance: Wi-Fi router / ONT gateway with dual antennas and status LEDs
  'nexus:equipment': svgIcon(
    createElement('rect', { x: 3, y: 13, width: 18, height: 7, rx: 2 }),
    createElement('line', { x1: 6, y1: 13, x2: 6, y2: 5 }),
    createElement('line', { x1: 18, y1: 13, x2: 18, y2: 5 }),
    createElement('circle', { cx: 7, cy: 16.5, r: 0.75 }),
    createElement('circle', { cx: 10, cy: 16.5, r: 0.75 }),
    createElement('circle', { cx: 13, cy: 16.5, r: 0.75 }),
    createElement('path', { d: 'M10 8.5a3 3 0 0 1 4 0' }),
    createElement('path', { d: 'M8.5 6a5.5 5.5 0 0 1 7 0' }),
  ),

  // Billing -> Accounts & Invoicing: Accounting invoice bill with serrated tear edge
  'nexus:invoices': svgIcon(
    createElement('path', { d: 'M4 2v19l3-1.5 3 1.5 3-1.5 3 1.5 4-2V2H4z' }),
    createElement('line', { x1: 8, y1: 6.5, x2: 16, y2: 6.5 }),
    createElement('line', { x1: 8, y1: 10.5, x2: 14, y2: 10.5 }),
    createElement('line', { x1: 8, y1: 14.5, x2: 12, y2: 14.5 }),
  ),

  // Billing -> Billing Registry: Master ledger database cylinder stack
  'nexus:registry': svgIcon(
    createElement('ellipse', { cx: 12, cy: 6, rx: 8, ry: 3 }),
    createElement('path', { d: 'M4 6v5c0 1.66 3.58 3 8 3s8-1.34 8-3V6' }),
    createElement('path', { d: 'M4 11v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5' }),
  ),
};
