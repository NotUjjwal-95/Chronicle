import crypto from 'crypto';
import { CanonicalSnapshotPayload, HandoverSnapshot } from '../../types';
import { canonicalizeJson } from '../../lib/canonical-json';

export function computeSnapshotSha256(payload: CanonicalSnapshotPayload): string {
  const canonicalString = canonicalizeJson(payload);
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

export interface SnapshotVerificationReport {
  snapshotId: string;
  versionTag: string;
  storedDigest: string;
  recomputedDigest: string;
  expectedDigest?: string;
  isIntegrityValid: boolean;
  canonicalByteLength: number;
  verifiedAt: string;
}

export function verifySnapshotIntegrity(
  snapshot: HandoverSnapshot,
  expectedDigest?: string
): SnapshotVerificationReport {
  const canonicalString = canonicalizeJson(snapshot.canonicalPayload);
  const recomputedDigest = crypto
    .createHash('sha256')
    .update(canonicalString, 'utf8')
    .digest('hex');

  const matchesStored = recomputedDigest === snapshot.sha256Digest;
  const matchesExpected = expectedDigest
    ? recomputedDigest.toLowerCase() === expectedDigest.toLowerCase()
    : true;

  return {
    snapshotId: snapshot.id,
    versionTag: snapshot.versionTag,
    storedDigest: snapshot.sha256Digest,
    recomputedDigest,
    expectedDigest,
    isIntegrityValid: matchesStored && matchesExpected,
    canonicalByteLength: Buffer.byteLength(canonicalString, 'utf8'),
    verifiedAt: new Date().toISOString(),
  };
}
