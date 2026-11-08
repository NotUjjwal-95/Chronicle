import { useProjectWorkspace } from '../../hooks/use-project-workspace';
import { EmptyState } from '../../components/shared/empty-state';
import { VoiceInterviewCard } from './voice-interview-card';

export function InterviewQueue() {
  const { interviews } = useProjectWorkspace();

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Knowledge-Gap Exit Interview Queue ({interviews.length})
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Targeted exit interview questions generated from single-point-of-failure modules and undocumented operational flags. Submitting an interview creates a grounded source transcript and a HUMAN_APPROVED decision claim.
        </p>
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          title="No Exit Interviews Visible"
          description="No knowledge-gap exit interviews exist at your current clearance tier."
        />
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => (
            <VoiceInterviewCard key={interview.id} interview={interview} />
          ))}
        </div>
      )}
    </div>
  );
}
