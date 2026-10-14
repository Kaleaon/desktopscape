import assert from 'node:assert';
import { test, describe } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DESIGN_TOKENS } from '../src/js/designTokens.js';
import {
  translateError,
  containsTechnicalJargon,
  ERROR_COPY_DICTIONARY,
  FALLBACK_ERROR_COPY
} from '../src/js/errorTranslationMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Centralized Design System Tokens', () => {
  test('DESIGN_TOKENS exports unified brand colors, button height variants, and component padding scale', () => {
    assert.ok(DESIGN_TOKENS, 'DESIGN_TOKENS must be exported');
    assert.ok(DESIGN_TOKENS.colors, 'Color tokens must be defined');
    assert.strictEqual(DESIGN_TOKENS.colors.brandPrimary, '#38ef7d');
    
    assert.ok(DESIGN_TOKENS.heights, 'Button height variants must be defined');
    assert.strictEqual(DESIGN_TOKENS.heights.sm, '32px');
    assert.strictEqual(DESIGN_TOKENS.heights.md, '40px');
    assert.strictEqual(DESIGN_TOKENS.heights.lg, '48px');

    assert.ok(DESIGN_TOKENS.padding, 'Component padding scale must be defined');
    assert.ok(DESIGN_TOKENS.padding.card, 'Card padding token must exist');
    assert.ok(DESIGN_TOKENS.padding.input, 'Input padding token must exist');
    assert.ok(DESIGN_TOKENS.padding.button, 'Button padding token must exist');
  });

  test('src/styles.css exports centralized CSS variables for tokens and components consume them', () => {
    const cssPath = path.join(__dirname, '../src/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify CSS variables defined in :root
    assert.ok(cssContent.includes('--brand-primary: #38ef7d'), 'CSS must define --brand-primary');
    assert.ok(cssContent.includes('--btn-height-sm: 32px'), 'CSS must define --btn-height-sm');
    assert.ok(cssContent.includes('--btn-height-md: 40px'), 'CSS must define --btn-height-md');
    assert.ok(cssContent.includes('--btn-height-lg: 48px'), 'CSS must define --btn-height-lg');
    assert.ok(cssContent.includes('--card-padding:'), 'CSS must define --card-padding');
    assert.ok(cssContent.includes('--input-padding:'), 'CSS must define --input-padding');

    // Verify core UI components use CSS token variables
    assert.ok(cssContent.includes('height: var(--btn-height-md)'), 'Button component must consume --btn-height-md token');
    assert.ok(cssContent.includes('padding: var(--input-padding)'), 'Form input components must consume --input-padding token');
    assert.ok(cssContent.includes('padding: var(--card-padding)'), 'Card and panel components must consume --card-padding token');
  });
});

describe('Client Copy Translation Middleware & Error Dictionary', () => {
  test('intercepts and maps ERR_CONN_REFUSED_502 to plain-language copy with recovery action', () => {
    const rawError = 'ERR_CONN_REFUSED_502: Failed to establish socket connection to remote engine';
    const translated = translateError(rawError);

    assert.strictEqual(translated.title, 'Connection Unavailable');
    assert.ok(!translated.message.includes('ERR_CONN_REFUSED_502'), 'Raw code must not be in user message');
    assert.ok(translated.recoveryAction.length > 0, 'Recovery action must be provided');
    assert.strictEqual(containsTechnicalJargon(translated.message), false);
  });

  test('intercepts database exceptions and maps to plain-language copy', () => {
    const dbErrors = [
      'SQLITE_BUSY: database is locked',
      'UNHANDLED_DATABASE_EXCEPTION: table write conflict',
      'PG::Error: connection to server failed',
      'ER_DUP_ENTRY: Duplicate primary key',
      'ERR_DB_LOCK: timeout waiting for row lock'
    ];

    for (const err of dbErrors) {
      const translated = translateError(err);
      assert.strictEqual(translated.title, 'Data Storage Busy');
      assert.ok(!translated.message.includes('SQLITE'), 'Message must not leak SQLITE');
      assert.ok(!translated.message.includes('UNHANDLED'), 'Message must not leak UNHANDLED');
      assert.ok(translated.recoveryAction.includes('retry') || translated.recoveryAction.includes('refresh'));
      assert.strictEqual(containsTechnicalJargon(translated.message), false);
    }
  });

  test('intercepts invalid input and YouTube processing errors', () => {
    const err = new Error('ERR_INVALID_URL: The provided URL is not a recognized YouTube video stream.');
    const translated = translateError(err);

    assert.strictEqual(translated.title, 'Invalid Video Source');
    assert.ok(!translated.message.includes('ERR_INVALID_URL'));
    assert.ok(translated.recoveryAction.includes('YouTube'));
  });

  test('fallback plain-language error copy for unmapped error codes prevents raw leaks', () => {
    const unexpectedErrors = [
      'ERR_UNKNOWN_KERNEL_FAIL_0x80004005 at Main.cpp:182',
      'UNCAUGHT_SYSTEM_EXCEPTION_9999',
      'HTTP_500_INTERNAL_FAIL_SERVICE_DEAD',
      '0x80070005 ACCESS_VIOLATION'
    ];

    for (const err of unexpectedErrors) {
      const translated = translateError(err);
      assert.ok(translated.title.length > 0);
      assert.ok(!translated.message.includes('0x80004005'));
      assert.ok(!translated.message.includes('UNCAUGHT'));
      assert.ok(translated.recoveryAction.length > 0);
      assert.strictEqual(containsTechnicalJargon(translated.title), false);
      assert.strictEqual(containsTechnicalJargon(translated.message), false);
    }
  });

  test('Automated Snapshot Matrix: 0% raw error codes leak across 25 error samples', () => {
    const sampleErrors = [
      'ERR_CONN_REFUSED_502',
      'ECONNREFUSED 127.0.0.1:8080',
      'ETIMEDOUT',
      '502 Bad Gateway',
      'SQLITE_BUSY: database is locked',
      'SQLITE_CORRUPT: disk image is malformed',
      'PG::Error: fatal connection loss',
      'ER_DUP_ENTRY',
      'UNHANDLED_DATABASE_EXCEPTION',
      'ERR_DB_LOCK',
      'INVALID_INPUT',
      'ERR_INVALID_URL',
      'NO_KEYFRAMES_FOUND',
      'UNAUTHORIZED_401',
      'HTTP 403 Forbidden',
      'INTERNAL_SERVER_ERROR',
      'HTTP 500',
      'ERR_INTERNAL_EXCEPTION',
      'Error: 0x80004005',
      'at Object.processVideo (youtubePipelineBackend.js:45)',
      'ORA-00001: unique constraint violated',
      'FATAL_DB_EXCEPTION_302',
      'NET::ERR_INTERNET_DISCONNECTED',
      '503 Service Unavailable',
      'Random unmapped backend throw: ERR_XYZ_99'
    ];

    for (const raw of sampleErrors) {
      const translated = translateError(raw);

      assert.ok(translated.title, `Title should be generated for '${raw}'`);
      assert.ok(translated.message, `Message should be generated for '${raw}'`);
      assert.ok(translated.recoveryAction, `Recovery action should be generated for '${raw}'`);

      assert.strictEqual(
        containsTechnicalJargon(translated.title),
        false,
        `Title '${translated.title}' leaked technical jargon for input '${raw}'`
      );
      assert.strictEqual(
        containsTechnicalJargon(translated.message),
        false,
        `Message '${translated.message}' leaked technical jargon for input '${raw}'`
      );
    }
  });
});
