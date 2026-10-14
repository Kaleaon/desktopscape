/**
 * Client Copy Translation Middleware for Peoria Gaussian Splat Desktop Engine.
 * Intercepts raw backend API errors, database exception codes, and technical jargon,
 * translating them into user-centric, conversational copy with clear recovery steps.
 */

export const ERROR_COPY_DICTIONARY = [
  {
    pattern: /ERR_CONN_REFUSED_502|ECONNREFUSED|ETIMEDOUT|502|503|504|NET::ERR|connection_refused/i,
    title: 'Connection Unavailable',
    message: 'The engine processing server is currently offline or taking too long to respond.',
    recoveryAction: 'Please check your network connection and click retry to resume.'
  },
  {
    pattern: /SQLITE|PG::|ER_DUP_ENTRY|DB_QUERY|ERR_DB_LOCK|UNHANDLED_DATABASE_EXCEPTION|DB_CONNECTION|ORA-\d+|FATAL_DB|DATABASE/i,
    title: 'Data Storage Busy',
    message: 'We could not save or retrieve your 3D landmark scene dataset at this moment.',
    recoveryAction: 'Please wait a moment and try refreshing the request.'
  },
  {
    pattern: /INVALID_INPUT|ERR_INVALID_URL|INVALID_YOUTUBE_URL|NO_KEYFRAMES|FRAME_EXTRACT|BAD_MEDIA/i,
    title: 'Invalid Video Source',
    message: 'The provided video URL or media batch link could not be recognized.',
    recoveryAction: 'Please enter a valid YouTube 4K video link and try again.'
  },
  {
    pattern: /UNAUTHORIZED|401|FORBIDDEN|403|ACCESS_DENIED/i,
    title: 'Access Restricted',
    message: 'You do not have permission to access or download this media stream.',
    recoveryAction: 'Please verify your credentials or permissions and retry.'
  },
  {
    pattern: /INTERNAL_SERVER_ERROR|HTTP_500|500|ERR_INTERNAL|PROCESSING_TIMEOUT/i,
    title: 'Processing Service Busy',
    message: 'The 3D Gaussian Splat feature extraction engine encountered a temporary problem.',
    recoveryAction: 'Please try submitting your request again in a few seconds.'
  }
];

export const FALLBACK_ERROR_COPY = {
  title: 'Unexpected Request Issue',
  message: 'An unexpected issue occurred while processing your request.',
  recoveryAction: 'Please try your action again or select a default Peoria landmark scene.'
};

/**
 * Technical Jargon & Code Sanitizer.
 * Inspects text for raw error codes, stack traces, database exception strings,
 * or engineering terms.
 */
export function containsTechnicalJargon(text) {
  if (!text || typeof text !== 'string') return false;
  const jargonPattern = /ERR_[A-Z0-9_]+|SQLITE_[A-Z_]+|[A-Z_]+_EXCEPTION|HTTP\s*\d{3}|[0-9]{3}_[A-Z_]+|at\s+\w+\.\w+|0x[0-9a-fA-F]+|\b(PG::|ORA-\d+|ECONNREFUSED|ETIMEDOUT)\b/i;
  return jargonPattern.test(text);
}

/**
 * Intercepts and translates raw error objects/messages before displaying to the user.
 * 
 * @param {Error|Object|string} error - The caught exception or error response
 * @returns {Object} Translated error copy object { title, message, recoveryAction, originalCode, isTranslated: true }
 */
export function translateError(error) {
  let rawString = '';
  let errorCode = null;

  if (!error) {
    return { ...FALLBACK_ERROR_COPY, originalCode: 'UNKNOWN', isTranslated: true };
  }

  if (typeof error === 'string') {
    rawString = error;
  } else if (error instanceof Error) {
    rawString = `${error.name || ''}: ${error.message || ''} ${error.code || ''}`;
    errorCode = error.code || null;
  } else if (typeof error === 'object') {
    rawString = `${error.error || ''} ${error.message || ''} ${error.code || ''} ${error.status || ''}`;
    errorCode = error.code || error.status || null;
  } else {
    rawString = String(error);
  }

  // 1. Search Dictionary for explicit code/pattern match
  for (const entry of ERROR_COPY_DICTIONARY) {
    if (entry.pattern.test(rawString)) {
      return {
        title: entry.title,
        message: entry.message,
        recoveryAction: entry.recoveryAction,
        originalCode: errorCode || 'MAPPED_ERROR',
        isTranslated: true
      };
    }
  }

  // 2. If no direct dictionary match, check if raw string contains technical jargon or raw codes
  if (containsTechnicalJargon(rawString)) {
    return {
      ...FALLBACK_ERROR_COPY,
      originalCode: errorCode || 'TECHNICAL_JARGON_SANITIZED',
      isTranslated: true
    };
  }

  // 3. If raw string is clean plain language (e.g. "Failed to process video keyframes"), return clean message with fallback recovery step
  return {
    title: 'Action Could Not Be Completed',
    message: rawString.length > 120 ? FALLBACK_ERROR_COPY.message : rawString,
    recoveryAction: 'Please check your input and try again.',
    originalCode: errorCode || 'USER_FRIENDLY',
    isTranslated: true
  };
}

/**
 * Express / Client Middleware wrapper function to intercept API responses
 */
export function clientErrorTranslationMiddleware(apiPromise) {
  return Promise.resolve(apiPromise).catch(err => {
    const translated = translateError(err);
    throw translated;
  });
}
