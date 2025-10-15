// components/cast-management/CharacterPageAssignment.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Users, Plus, BookOpen } from 'lucide-react';
import { useBookStore, PersonId } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

interface CharacterPageAssignmentProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHARACTER_LABELS: Record<PersonId, string> = {
  baby: 'Baby',
  mom: 'Mom',
  dad: 'Dad',
  grandma: 'Grandma',
  grandpa: 'Grandpa',
  sibling: 'Sibling',
  aunt: 'Aunt',
  uncle: 'Uncle',
  friend: 'Friend'
};

export function CharacterPageAssignment({ isOpen, onClose }: CharacterPageAssignmentProps) {
  const { storyData, cast, babyProfile } = useBookStore();

  // Initialize character assignments from story data
  const [pageAssignments, setPageAssignments] = useState<Record<number, PersonId[]>>(() => {
    if (!storyData?.pages) return {};
    const assignments: Record<number, PersonId[]> = {};
    storyData.pages.forEach((page, index) => {
      assignments[index] = page.characters_on_page || ['baby'];
    });
    return assignments;
  });

  // Get all characters in the cast
  const allCharacters = Object.keys(cast) as PersonId[];

  const toggleCharacter = (pageIndex: number, characterId: PersonId) => {
    setPageAssignments(prev => {
      const currentChars = prev[pageIndex] || [];
      const updated = currentChars.includes(characterId)
        ? currentChars.filter(id => id !== characterId)
        : [...currentChars, characterId];

      return {
        ...prev,
        [pageIndex]: updated
      };
    });
  };

  const handleSave = () => {
    if (!storyData) return;

    // Update story data with new character assignments
    const updatedPages = storyData.pages.map((page, index) => ({
      ...page,
      characters_on_page: pageAssignments[index] || ['baby']
    }));

    useBookStore.setState({
      storyData: {
        ...storyData,
        pages: updatedPages
      }
    });

    toast.success('Character assignments updated!');
    onClose();
  };

  if (!isOpen || !storyData?.pages) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6 text-white">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-patrick font-bold truncate">Assign Characters to Pages</h2>
                  <p className="text-purple-100 text-xs sm:text-sm">Choose who appears on each page</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)]">
            <div className="space-y-4 sm:space-y-6">
              {storyData.pages.map((page, index) => (
                <div key={index} className="card-magical">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-base sm:text-lg">
                      {page.page_number}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base lg:text-lg font-patrick text-gray-700 mb-2 sm:mb-3">
                        "{page.narration}"
                      </p>

                      <div className="space-y-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">
                          Characters on this page:
                        </p>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {allCharacters.map(charId => {
                            const isSelected = (pageAssignments[index] || []).includes(charId);
                            const charName = charId === 'baby'
                              ? babyProfile?.baby_name || 'Baby'
                              : CHARACTER_LABELS[charId] || charId;
                            const hasPhoto = cast[charId]?.identityAnchorUrl || (cast[charId]?.fallbackPhotos?.length ?? 0) > 0;

                            return (
                              <button
                                key={charId}
                                onClick={() => toggleCharacter(index, charId)}
                                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {isSelected && <Check className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
                                <span className="whitespace-nowrap">{charName}</span>
                                {!hasPhoto && <span className="ml-1 text-[10px] sm:text-xs">⚠️</span>}
                              </button>
                            );
                          })}
                        </div>

                        {/* Auto-detected badge */}
                        {page.characters_on_page && page.characters_on_page.length > 0 && (
                          <p className="text-[10px] sm:text-xs text-purple-600 mt-2">
                            ✨ Auto-detected: {page.characters_on_page.map(id => CHARACTER_LABELS[id] || id).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning for characters without photos */}
            {allCharacters.some(charId => {
              const hasPhoto = cast[charId]?.identityAnchorUrl || (cast[charId]?.fallbackPhotos?.length ?? 0) > 0;
              return !hasPhoto;
            }) && (
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs sm:text-sm text-amber-800">
                  ⚠️ <strong>Note:</strong> Characters marked with ⚠️ don't have photos yet.
                  Add photos in the Cast Manager for better illustrations.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="btn-secondary px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base order-2 sm:order-1"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="btn-primary px-6 sm:px-8 py-2 sm:py-2.5 flex items-center justify-center gap-2 text-sm sm:text-base order-1 sm:order-2"
              >
                <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="whitespace-nowrap">Save & Continue</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
