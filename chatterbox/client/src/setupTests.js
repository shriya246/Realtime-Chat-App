/**
 * Purpose: Extends Jest DOM assertions for frontend component test suites.
 */

import '@testing-library/jest-dom';

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn()
});
