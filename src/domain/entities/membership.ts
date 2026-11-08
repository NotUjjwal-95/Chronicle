import { ClearanceTier, ProjectRole } from '../../types';

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  displayName: string;
  orgRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  maxClearanceTier: ClearanceTier;
  createdAt: string;
}

export interface ProjectMembership {
  id: string;
  organizationId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  clearanceTier: ClearanceTier;
  createdAt: string;
}

export interface AuthenticatedSession {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  projectId: string;
  role: ProjectRole;
  actualClearanceTier: ClearanceTier;
  shadowPreviewTier?: ClearanceTier | null;
  effectiveClearanceTier: ClearanceTier;
  isShadowPreview: boolean;
}
