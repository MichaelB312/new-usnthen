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
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8" />
                <div>
                  <h2 className="text-2xl font-patrick font-bold">Assign Characters to Pages</h2>
                  <p className="text-purple-100 text-sm">Choose who appears on each page of the story</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="space-y-6">
              {storyData.pages.map((page, index) => (
                <div key={index} className="card-magical">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                      {page.page_number}
                    </div>

                    <div className="flex-1">
                      <p className="text-lg font-patrick text-gray-700 mb-3">
                        "{page.narration}"
                      </p>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600 mb-2">
                          Characters on this page:
                        </p>

                        <div className="flex flex-wrap gap-2">
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
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {isSelected && <Check className="inline h-4 w-4 mr-1" />}
                                {charName}
                                {!hasPhoto && <span className="ml-1 text-xs">⚠️</span>}
                              </button>
                            );
                          })}
                        </div>

                        {/* Auto-detected badge */}
                        {page.characters_on_page && page.characters_on_page.length > 0 && (
                          <p className="text-xs text-purple-600 mt-2">
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
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  ⚠️ <strong>Note:</strong> Characters marked with ⚠️ don't have photos yet.
                  Add photos in the Cast Manager for better illustrations.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="btn-secondary px-6"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="btn-primary px-8 flex items-center gap-2"
              >
                <Check className="h-5 w-5" />
                Save & Continue
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
