import { useState, FormEvent } from 'react';
import { Mic, MicOff, CheckCircle2 } from 'lucide-react';
import { ExitInterview, InterviewStatus } from '../../types';
import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { useSpeechRecognition } from '../../hooks/use-speech-recognition';
import { ClearanceBadge } from '../../components/shared/clearance-badge';
import { formatShortTimestamp } from '../../lib/utils';

const PRESET_ANSWERS: Record<string, string> = {
  'int-gap-01':
    'To reload config/whitelist.json without triggering the SIGHUP crash regression, run `scripts/validate-cidr-checksum.ts` first to verify the CRC32 tag on the three sovereign banking CIDR blocks, then send SIGUSR2 instead of SIGHUP so the worker swaps the lookup table atomically.',
  'int-gap-02':
    'Never enable PAYMENT_DRAIN_OVERRIDE while outbox lock contention is active. First pause the retry worker consumer group, run `SELECT reconcile_outbox_dead_letters(72)` inside a single read-committed transaction, and then resume the SKIP LOCKED worker.',
};

export function VoiceInterviewCard({
  interview,
}: {
  interview: ExitInterview;
}) {
  const { session, isMutating, submitInterview } = useProjectWorkspace();
  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition();

  const [transcript, setTranscript] = useState(
    interview.answerTranscript ||
      PRESET_ANSWERS[interview.id] ||
      'Verified operational handover procedure for module recovery and safe state transitions.'
  );

  const canSubmit =
    session &&
    !session.isShadowPreview &&
    interview.status === InterviewStatus.PENDING;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (isListening) stopListening();
    await submitInterview(interview.id, transcript);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-5 bg-white dark:bg-slate-900 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {interview.id}
            </span>
            <span aria-hidden="true">·</span>
            <span>Departing Contributor: @{interview.contributorHandle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-blue-600 dark:text-blue-400">
              Module: {interview.modulePath}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Status:{' '}
              <strong
                className={
                  interview.status === InterviewStatus.COMPLETED
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                {interview.status}
              </strong>
            </span>
          </div>

          <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-slate-100">
            {interview.question}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {interview.contextSummary}
          </p>
        </div>

        <ClearanceBadge tier={interview.accessTier} />
      </div>

      {interview.status === InterviewStatus.COMPLETED ? (
        <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-4 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Exit Interview Completed (
              {interview.completedAt
                ? formatShortTimestamp(interview.completedAt)
                : ''}
              ) · Generated Claim IDs:{' '}
              {interview.generatedClaimIds.join(', ')}
            </span>
          </div>
          <p className="font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {interview.answerTranscript}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Departing Engineer Response Transcript (Sanitized & grounded into a HUMAN_APPROVED claim)
              </label>

              {isSupported ? (
                <button
                  type="button"
                  onClick={() =>
                    isListening
                      ? stopListening()
                      : startListening((chunk) =>
                          setTranscript((prev) => `${prev} ${chunk}`.trim())
                        )
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    isListening
                      ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop Voice Capture</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Dictate Response</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>

            <textarea
              rows={3}
              required
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit || isMutating}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              Submit Interview & Ground Claim
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
