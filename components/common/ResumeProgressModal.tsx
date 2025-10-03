'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { SavedProgress, getProgressDescription, clearProgress } from '@/lib/store/progressStore';

interface ResumeProgressModalProps {
  progress: SavedProgress;
  onResume: () => void;
  onStartNew: () => void;
}

export function ResumeProgressModal({ progress, onResume, onStartNew }: ResumeProgressModalProps) {
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
              Welcome Back!
            </h2>
            <p className="text-gray-600">
              You have saved progress from before
            </p>
          </div>

          <div className="bg-purple-50 rounded-2xl p-4 mb-6 border-2 border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Saved Progress:</p>
            <p className="text-lg font-semibold text-purple-700">
              {getProgressDescription(progress)}
            </p>
            {progress.babyProfile && (
              <p className="text-sm text-gray-600 mt-2">
                Story for {progress.babyProfile.baby_name}
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
              Continue Where I Left Off
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartNew}
              className="w-full border-2 border-gray-300 text-gray-700 hover:border-red-400 hover:text-red-700 hover:bg-red-50 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-5 w-5" />
              Start a New Book
            </motion.button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Saved progress expires after 30 days
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
