import { CandidateFact, ClaimCategory } from '../../types';

interface CanonicalTopicRule {
  topicKey: string;
  keywords: RegExp;
  stanceMatchers: Array<{ pattern: RegExp; stance: string }>;
}

const CANONICAL_TOPIC_RULES: CanonicalTopicRule[] = [
  {
    topicKey: 'session-signing-algorithm',
    keywords: /\b(session|jwt|ed25519|hs256|hmac|signing|middleware\/session\.ts)\b/i,
    stanceMatchers: [
      {
        pattern: /\b(ed25519|asymmetric)\b/i,
        stance: 'ASYMMETRIC_ED25519',
      },
      {
        pattern: /\b(hs256|shared[\s-]secret|symmetric\s+hmac)\b/i,
        stance: 'SYMMETRIC_HS256',
      },
    ],
  },
  {
    topicKey: 'retry-queue-backing-store',
    keywords: /\b(retry|dlq|dead[\s-]letter|bullmq|redis|kafka|sqs|workers\/retry\.ts)\b/i,
    stanceMatchers: [
      {
        pattern: /\b(postgresql\s+skip\s+locked|pg_boss|postgres[\s-]backed|transactional\s+outbox)\b/i,
        stance: 'POSTGRES_TRANSACTIONAL_OUTBOX',
      },
      {
        pattern: /\b(redis\s+streams|bullmq|volatile\s+redis)\b/i,
        stance: 'REDIS_STREAMS_BULLMQ',
      },
    ],
  },
  {
    topicKey: 'settlement-webhook-timeout',
    keywords: /\b(webhook|settlement|timeout|sla|charge\.ts|idempotency\s+window)\b/i,
    stanceMatchers: [
      {
        pattern: /\b(3000\s*ms|3\s*s(?:ec(?:ond)?s?)?|strict\s+3s)\b/i,
        stance: 'STRICT_3000MS_CUTOFF',
      },
      {
        pattern: /\b(15000\s*ms|15\s*s(?:ec(?:ond)?s?)?|extended\s+15s)\b/i,
        stance: 'EXTENDED_15000MS_WINDOW',
      },
    ],
  },
];

function inferTopicAndStance(
  sentence: string,
  category: ClaimCategory
): { topicKey: string; stanceValue: string } {
  for (const rule of CANONICAL_TOPIC_RULES) {
    if (rule.keywords.test(sentence)) {
      for (const matcher of rule.stanceMatchers) {
        if (matcher.pattern.test(sentence)) {
          return {
            topicKey: rule.topicKey,
            stanceValue: matcher.stance,
          };
        }
      }
    }
  }

  const pathMatch = sentence.match(
    /\b((?:src|config|supabase|services|workers)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)\b/
  );
  if (pathMatch) {
    const normalizedPath = pathMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      topicKey: `module-${normalizedPath}`,
      stanceValue: `${category}_STATED`,
    };
  }

  const words = sentence
    .toLowerCase()
    .replace(/\[redacted:[^\]]+\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        ![
          'this',
          'that',
          'with',
          'from',
          'have',
          'were',
          'been',
          'will',
          'should',
          'must',
          'into',
          'when',
          'where',
        ].includes(w)
    )
    .slice(0, 4);

  return {
    topicKey: words.length > 0 ? `${category.toLowerCase()}-${words.join('-')}` : `${category.toLowerCase()}-general`,
    stanceValue: 'ASSERTED',
  };
}

function classifySentence(sentence: string): {
  category: ClaimCategory;
  confidenceScore: number;
} | null {
  const trimmed = sentence.trim();
  if (trimmed.length < 18) {
    return null;
  }

  // 1. Unfinished work patterns
  if (
    /\b(TODO|WIP|FIXME|blocked\s+by|incomplete|unscheduled|not\s+yet\s+implemented|pending\s+migration|remaining\s+work)\b/i.test(
      trimmed
    )
  ) {
    return { category: ClaimCategory.UNFINISHED_WORK, confidenceScore: 0.89 };
  }

  // 2. Risk & Blocker indicators
  if (
    /\b(regression|outage|security\s+exposure|vulnerability|single\s+point\s+of\s+failure|data\s+loss|race\s+condition|deadlock|critical\s+risk|sev-?[12]|silent\s+drop)\b/i.test(
      trimmed
    )
  ) {
    return { category: ClaimCategory.RISK_BLOCKER, confidenceScore: 0.91 };
  }

  // 3. Decision verbs
  if (
    /\b(migrated|replaced|deprecated|switched|standardized\s+on|decided\s+to|adopted|enforced|architected)\b/i.test(
      trimmed
    )
  ) {
    return { category: ClaimCategory.DECISION, confidenceScore: 0.88 };
  }

  // 4. Ownership & contact patterns
  if (
    /(?:@[a-zA-Z0-9_-]{2,}).*\b(owns|owner|maintainer|on-call|responsible\s+for|point\s+of\s+contact|authored|lead)\b|\b(primary\s+owner|sole\s+maintainer|on-call\s+escalation)\b.*(?:@[a-zA-Z0-9_-]{2,})/i.test(
      trimmed
    )
  ) {
    return { category: ClaimCategory.OWNERSHIP_CONTACT, confidenceScore: 0.86 };
  }

  // 5. Dependency patterns
  if (
    /\b(depends\s+on|coupled\s+to|requires\s+package|upstream\s+service|downstream\s+consumer|environment\s+variable|queue\s+binding)\b/i.test(
      trimmed
    ) &&
    (/\b(?:src\/|config\/|[A-Z0-9_]{4,}|redis|postgres|kafka|stripe|vault)\b/i.test(trimmed))
  ) {
    return { category: ClaimCategory.DEPENDENCY, confidenceScore: 0.84 };
  }

  // 6. Recommended Next Action
  if (
    /\b(next\s+action|must\s+update|handover\s+action|first\s+week|incoming\s+owner\s+must|action\s+item)\b/i.test(
      trimmed
    )
  ) {
    return { category: ClaimCategory.NEXT_ACTION, confidenceScore: 0.85 };
  }

  return null;
}

function buildTitleFromSentence(sentence: string, category: ClaimCategory): string {
  const clean = sentence
    .replace(/^[-*•#\d.)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= 88) {
    return clean;
  }
  const prefixLabel: Record<ClaimCategory, string> = {
    [ClaimCategory.DECISION]: 'Decision',
    [ClaimCategory.UNFINISHED_WORK]: 'Unfinished',
    [ClaimCategory.RISK_BLOCKER]: 'Risk',
    [ClaimCategory.DEPENDENCY]: 'Dependency',
    [ClaimCategory.OWNERSHIP_CONTACT]: 'Ownership',
    [ClaimCategory.NEXT_ACTION]: 'Action',
  };
  return `${prefixLabel[category]}: ${clean.slice(0, 76).trim()}...`;
}

/**
 * Extracts deterministic candidate facts from sanitized source content without an AI key.
 * Preserves exact character start/end coordinates into `sanitizedContent`.
 */
export function extractDeterministicCandidates(params: {
  sourceId: string;
  sanitizedContent: string;
}): CandidateFact[] {
  const { sourceId, sanitizedContent } = params;
  if (!sanitizedContent || sanitizedContent.trim().length === 0) {
    return [];
  }

  const candidates: CandidateFact[] = [];
  // Segment into sentences/lines while preserving exact character offsets
  const segmentRegex = /[^\n.!?]+(?:[.!?]+|\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = segmentRegex.exec(sanitizedContent)) !== null) {
    const rawSegment = match[0];
    const leadingWhitespace = rawSegment.length - rawSegment.trimStart().length;
    const trailingWhitespace = rawSegment.length - rawSegment.trimEnd().length;

    const charStart = match.index + leadingWhitespace;
    const charEnd = match.index + rawSegment.length - trailingWhitespace;

    if (charEnd <= charStart) {
      continue;
    }

    const exactQuote = sanitizedContent.slice(charStart, charEnd);
    const classification = classifySentence(exactQuote);
    if (!classification) {
      continue;
    }

    const { topicKey, stanceValue } = inferTopicAndStance(
      exactQuote,
      classification.category
    );

    candidates.push({
      category: classification.category,
      topicKey,
      stanceValue,
      title: buildTitleFromSentence(exactQuote, classification.category),
      summary: exactQuote,
      sourceId,
      charStart,
      charEnd,
      confidenceScore: classification.confidenceScore,
      extractionOrigin: 'DETERMINISTIC',
    });
  }

  return candidates;
}
