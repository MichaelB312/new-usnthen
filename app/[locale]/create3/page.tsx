'use client';

/**
 * Us & Then 3.0 - Complete book creation flow
 *
 * This is the new 3.0 system that replaces the old conversation-based approach
 * with a structured, guided experience.
 */

import Create3Flow from '@/components/story-wizard/Create3Flow';
import { useRouter } from '@/navigation';

export default function Create3Page() {
  const router = useRouter();

  const handleComplete = () => {
    // When the story is complete, navigate to illustrations
    router.push('/create?step=4'); // Jump to illustrations step
  };

  return <Create3Flow onComplete={handleComplete} />;
}
