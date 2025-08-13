'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RefreshCw, Edit2, Check, Sparkles, ChevronRight } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface StoryReviewProps {
  onContinue: () => void;
  onRegenerate: () => void;
}

export function StoryReview({ onContinue, onRegenerate }: StoryReviewProps) {
  const { storyData, babyProfile } = useBookStore();
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');

  const handleEdit = (pageIndex: number) => {
    setEditingPage(pageIndex);
    setEditedText(storyData?.pages[pageIndex].narration || '');
  };

  const saveEdit = () => {
    if (editingPage !== null && storyData) {
      const updatedPages = [...storyData.pages];
      updatedPages[editingPage].narration = editedText;
      
      useBookStore.setState({
        storyData: {
          ...storyData,
          pages: updatedPages
        }
      });
      
      setEditingPage(null);
      toast.success('Text updated!');
    }
  };

  const cancelEdit = () => {
    setEditingPage(null);
    setEditedText('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="card-magical text-center">
        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
          <BookOpen className="h-12 w-12 text-purple-600" />
        </div>
        <h2 className="text-4xl font-patrick gradient-text mb-3">
          Your Story is Ready!
        </h2>
        <p className="text-xl text-gray-600">
          Review your story before we create the illustrations
        </p>
      </div>

      {/* Story Title */}
      <div className="card-magical">
        <h3 className="text-2xl font-patrick text-center mb-6 gradient-text">
          "{storyData?.title}"
        </h3>
        <p className="text-center text-gray-600">
          A magical story for {babyProfile?.baby_name}
        </p>
      </div>

      {/* Story Pages */}
      <div className="card-magical">
        <div className="space-y-6">
          {storyData?.pages.map((page, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-l-4 border-purple-300 pl-6 py-4 hover:bg-purple-50 rounded-r-lg transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-purple-600">
                  Page {page.page_number}
                </span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {page.scene_type.replace('_', ' ')}
                </span>
              </div>
              
              {editingPage === index ? (
                <div className="space-y-3">
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full p-3 border-2 border-purple-300 rounded-lg resize-none focus:outline-none focus:border-purple-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-gray-700 leading-relaxed pr-10">
                    {page.narration}
                  </p>
                  <button
                    onClick={() => handleEdit(index)}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-white rounded-lg"
                  >
                    <Edit2 className="h-4 w-4 text-purple-600" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="card-magical">
        <div className="grid md:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRegenerate}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Regenerate Entire Story
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onContinue}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Continue to Illustrations
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          You can edit individual pages by clicking the edit icon
        </p>
      </div>
    </div>
  );
}