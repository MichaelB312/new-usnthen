'use client';

import { motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { saveProgress, SavedProgress } from '@/lib/store/progressStore';
import { useRouter } from 'next/navigation';

interface SaveProgressButtonProps {
  currentStep: number;
  babyProfile?: any;
  conversation?: any[];
  storyData?: any;
  generatedImages?: any[];
  bookId?: string;
  variant?: 'primary' | 'secondary';
}

export function SaveProgressButton({
  currentStep,
  babyProfile,
  conversation,
  storyData,
  generatedImages,
  bookId,
  variant = 'secondary'
}: SaveProgressButtonProps) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);

    try {
      const progress: SavedProgress = {
        savedAt: new Date().toISOString(),
        currentStep,
        babyProfile,
        conversation,
        storyData,
        generatedImages,
        bookId
      };

      saveProgress(progress);

      toast.success('Progress saved! You can continue later.', {
        duration: 3000,
        icon: '💾'
      });

      // Wait a bit then redirect to home
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (error) {
      toast.error('Failed to save progress');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleSave}
      disabled={saving}
      className={`
        flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all w-full sm:w-auto
        ${variant === 'primary'
          ? 'bg-purple-600 text-white hover:bg-purple-700'
          : 'border-2 border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {saving ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Save className="h-4 w-4" />
          Save & Continue Later
        </>
      )}
    </motion.button>
  );
}
