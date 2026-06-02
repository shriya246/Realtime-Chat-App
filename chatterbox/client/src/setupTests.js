/**
 * Purpose: Extends Jest DOM assertions for frontend component test suites.
 */

import '@testing-library/jest-dom';

import { TextDecoder, TextEncoder } from 'util';

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn()
});
