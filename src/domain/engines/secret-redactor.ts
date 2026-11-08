import { RedactionRecord } from '../../types';

export interface RedactionOptions {
  redactEmails?: boolean;
  redactPrivateIps?: boolean;
}

export interface RedactionResult {
  sanitizedContent: string;
  redactionMetadata: RedactionRecord[];
  redactedCount: number;
}

interface SecretPatternRule {
  patternType: string;
  regex: RegExp;
  replacementLabel: string;
}

const SECRET_RULES: SecretPatternRule[] = [
  {
    patternType: 'POSTGRES_OR_REDIS_URI',
    regex: /\b(?:postgres(?:ql)?|rediss?):\/\/[^\s"'`<>]+/gi,
    replacementLabel: '[REDACTED:CONNECTION_URI]',
  },
  {
    patternType: 'GITHUB_PAT',
    regex: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replacementLabel: '[REDACTED:GITHUB_PAT]',
  },
  {
    patternType: 'STRIPE_OR_OPENAI_KEY',
    regex: /\b(?:sk_live_[A-Za-z0-9_]{12,}|sk_test_[A-Za-z0-9_]{12,}|rk_live_[A-Za-z0-9_]{12,}|whsec_[A-Za-z0-9_]{12,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g,
    replacementLabel: '[REDACTED:API_SECRET_KEY]',
  },
  {
    patternType: 'AWS_ACCESS_KEY_ID',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacementLabel: '[REDACTED:AWS_ACCESS_KEY]',
  },
  {
    patternType: 'SLACK_TOKEN',
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
    replacementLabel: '[REDACTED:SLACK_TOKEN]',
  },
  {
    patternType: 'JWT_TOKEN',
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacementLabel: '[REDACTED:JWT_TOKEN]',
  },
  {
    patternType: 'SECRET_ASSIGNMENT',
    regex: /\b(?:password|passwd|secret|api_key|apikey|access_token|auth_token|private_key|webhook_secret|client_secret|hmac_secret)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{8,})["']?/gi,
    replacementLabel: '[REDACTED:SECRET_ASSIGNMENT]',
  },
];

const PRIVATE_IP_RULE: SecretPatternRule = {
  patternType: 'PRIVATE_NETWORK_HOST',
  regex: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(?::\d{2,5})?\b/g,
  replacementLabel: '[REDACTED:INTERNAL_HOST]',
};

const EMAIL_RULE: SecretPatternRule = {
  patternType: 'SENSITIVE_EMAIL',
  regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  replacementLabel: '[REDACTED:EMAIL]',
};

/**
 * Redacts sensitive credentials and secrets before persistence, deterministic extraction, or AI processing.
 * Never stores the raw secret in metadata; computes downstream character coordinates on the sanitized text.
 */
export function redactSecrets(
  rawContent: string,
  options: RedactionOptions = {}
): RedactionResult {
  if (!rawContent) {
    return {
      sanitizedContent: '',
      redactionMetadata: [],
      redactedCount: 0,
    };
  }

  const activeRules: SecretPatternRule[] = [...SECRET_RULES];
  if (options.redactPrivateIps) {
    activeRules.push(PRIVATE_IP_RULE);
  }
  if (options.redactEmails) {
    activeRules.push(EMAIL_RULE);
  }

  interface MatchSpan {
    start: number;
    end: number;
    patternType: string;
    replacementToken: string;
    originalLength: number;
  }

  const rawSpans: MatchSpan[] = [];

  for (const rule of activeRules) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawContent)) !== null) {
      const matchedText = match[0];
      // Skip already-redacted placeholders to prevent double-matching
      if (matchedText.includes('[REDACTED:')) {
        continue;
      }
      const start = match.index;
      const end = start + matchedText.length;

      // For SECRET_ASSIGNMENT, preserve the key name prefix while redacting the secret value
      if (rule.patternType === 'SECRET_ASSIGNMENT') {
        const delimiterMatch = matchedText.match(/^([A-Za-z0-9_]+\s*[:=]\s*)/);
        const keyPrefix = delimiterMatch ? delimiterMatch[1] : '';
        rawSpans.push({
          start,
          end,
          patternType: rule.patternType,
          replacementToken: `${keyPrefix}${rule.replacementLabel}`,
          originalLength: matchedText.length,
        });
      } else {
        rawSpans.push({
          start,
          end,
          patternType: rule.patternType,
          replacementToken: rule.replacementLabel,
          originalLength: matchedText.length,
        });
      }
    }
  }

  if (rawSpans.length === 0) {
    return {
      sanitizedContent: rawContent,
      redactionMetadata: [],
      redactedCount: 0,
    };
  }

  // Sort by start index ascending, and prefer longer matches if overlapping at the same start
  rawSpans.sort((a, b) => (a.start !== b.start ? a.start - b.start : b.end - a.end));

  const nonOverlapping: MatchSpan[] = [];
  let lastEnd = -1;
  for (const span of rawSpans) {
    if (span.start >= lastEnd) {
      nonOverlapping.push(span);
      lastEnd = span.end;
    }
  }

  let cursor = 0;
  let sanitizedContent = '';
  const redactionMetadata: RedactionRecord[] = [];

  for (const span of nonOverlapping) {
    sanitizedContent += rawContent.slice(cursor, span.start);
    const sanitizedStart = sanitizedContent.length;
    sanitizedContent += span.replacementToken;
    const sanitizedEnd = sanitizedContent.length;

    redactionMetadata.push({
      patternType: span.patternType,
      originalLength: span.originalLength,
      sanitizedStart,
      sanitizedEnd,
      replacementToken: span.replacementToken,
    });

    cursor = span.end;
  }

  sanitizedContent += rawContent.slice(cursor);

  return {
    sanitizedContent,
    redactionMetadata,
    redactedCount: redactionMetadata.length,
  };
}
