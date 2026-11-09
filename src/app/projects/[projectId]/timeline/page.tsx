'use client';

import { ReconstructionControls } from '../../../../features/reconstruction/reconstruction-controls';
import { TimelineView } from '../../../../features/reconstruction/timeline-view';

export default function TimelinePage() {
  return (
    <div className="space-y-6">
      <ReconstructionControls />
      <TimelineView />
    </div>
  );
}

