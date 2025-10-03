// components/book-preview/IntegratedBookPreview.tsx
'use client';

import { LandscapeSpreadViewer } from './LandscapeSpreadViewer';

export function IntegratedBookPreview({ onComplete }: { onComplete: () => void }) {
  // Use landscape spread viewer as the default and only implementation
  return <LandscapeSpreadViewer onComplete={onComplete} />;
}

