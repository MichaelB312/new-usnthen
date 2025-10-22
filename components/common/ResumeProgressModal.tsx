'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { SavedProgress, clearProgress } from '@/lib/store/progressStore';
import { useTranslations } from 'next-intl';

interface ResumeProgressModalProps {
  progress: SavedProgress;
  onResume: () => void;
  onStartNew: () => void;
}

export function ResumeProgressModal({ progress, onResume, onStartNew }: ResumeProgressModalProps) {
  const t = useTranslations();

  const getProgressDescription = (progress: SavedProgress): string => {
    const stepNames = [
      t('progressSteps.gettingStarted'),
      t('progressSteps.babyProfile'),
      t('progressSteps.memoryChat'),
      t('progressSteps.storyReview'),
      t('progressSteps.illustrations'),
      t('progressSteps.bookPreview'),
      t('progressSteps.complete')
    ];

    const stepName = stepNames[progress.currentStep] || t('progressSteps.unknownStep');
    const savedDate = new Date(progress.savedAt);
    const timeAgo = getTimeAgo(savedDate);

    return `${stepName} • ${t('progressSteps.saved')} ${timeAgo}`;
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('timeAgo.justNow');
    if (diffMins === 1) return t('timeAgo.minuteAgo', { count: diffMins });
    if (diffMins < 60) return t('timeAgo.minutesAgo', { count: diffMins });
    if (diffHours === 1) return t('timeAgo.hourAgo', { count: diffHours });
    if (diffHours < 24) return t('timeAgo.hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('timeAgo.dayAgo', { count: diffDays });
    if (diffDays < 30) return t('timeAgo.daysAgo', { count: diffDays });
    return t('timeAgo.overMonthAgo');
  };

  const handleStartNew = () => {
    clearProgress();
    onStartNew();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
        >
          <div className="text-center mb-6">
            <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
              <Clock className="h-10 w-10 text-purple-600" />
            </div>
            <h2 className="text-3xl font-patrick gradient-text mb-2">
              {t('resumeProgress.title')}
            </h2>
            <p className="text-gray-600">
              {t('resumeProgress.subtitle')}
            </p>
          </div>

          <div className="bg-purple-50 rounded-2xl p-4 mb-6 border-2 border-purple-200">
            <p className="text-sm text-gray-600 mb-1">{t('resumeProgress.savedProgress')}</p>
            <p className="text-lg font-semibold text-purple-700">
              {getProgressDescription(progress)}
            </p>
            {progress.babyProfile && (
              <p className="text-sm text-gray-600 mt-2">
                {t('resumeProgress.storyFor', { babyName: progress.babyProfile.baby_name })}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onResume}
              className="w-full btn-primary py-4 flex items-center justify-center gap-2"
            >
              <ArrowRight className="h-5 w-5" />
              {t('resumeProgress.continueButton')}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartNew}
              className="w-full border-2 border-gray-300 text-gray-700 hover:border-red-400 hover:text-red-700 hover:bg-red-50 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-5 w-5" />
              {t('resumeProgress.startNewButton')}
            </motion.button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            {t('resumeProgress.expirationNote')}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
