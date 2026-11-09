'use client';

import { ReactNode } from 'react';
import { ProjectWorkspaceProvider } from '../hooks/use-project-workspace';

export function Providers({ children }: { children: ReactNode }) {
  return <ProjectWorkspaceProvider>{children}</ProjectWorkspaceProvider>;
}

