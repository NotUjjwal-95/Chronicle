import { ClearanceTier, InterviewStatus } from '../../types';

export interface ExitInterview {
  id: string;
  organizationId: string;
  projectId: string;
  contributorHandle: string;
  contributorName: string;
  topicKey: string;
  modulePath: string;
  question: string;
  contextSummary: string;
  status: InterviewStatus;
  accessTier: ClearanceTier;
  answerTranscript?: string | null;
  generatedClaimIds: string[];
  createdAt: string;
  completedAt?: string | null;
  completedByUserId?: string | null;
}
