// components/cast-management/CastManagerWithDescriptions.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Upload, Camera, Plus, X, Check, 
  User, Baby, Heart, Star, Crown, Sparkles,
  Image, FileText, Shield, Edit2, Eye, Trash2
} from 'lucide-react';
import { useBookStore, PersonId, CastMember, UploadedPhoto } from '@/lib/store/bookStore';
import { CharacterDescriptionModal } from '@/components/character-description/CharacterDescriptionModal';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface CastManagerProps {
  onComplete: () => void;
}

const CHARACTER_OPTIONS: { id: PersonId; label: string; icon: any; gradient: string }[] = [
  { id: 'baby', label: 'Baby', icon: Baby, gradient: 'from-pink-400 to-pink-600' },
  { id: 'mom', label: 'Mom', icon: Heart, gradient: 'from-purple-400 to-purple-600' },
  { id: 'dad', label: 'Dad', icon: User, gradient: 'from-blue-400 to-blue-600' },
  { id: 'grandma', label: 'Grandma', icon: Crown, gradient: 'from-amber-400 to-amber-600' },
  { id: 'grandpa', label: 'Grandpa', icon: Star, gradient: 'from-green-400 to-green-600' },
  { id: 'sibling', label: 'Sibling', icon: Users, gradient: 'from-teal-400 to-teal-600' },
  { id: 'aunt', label: 'Aunt', icon: Heart, gradient: 'from-rose-400 to-rose-600' },
  { id: 'uncle', label: 'Uncle', icon: User, gradient: 'from-indigo-400 to-indigo-600' },
  { id: 'friend', label: 'Friend', icon: Sparkles, gradient: 'from-yellow-400 to-yellow-600' }
];

type InputMode = 'choice' | 'upload' | 'describe';

export function CastManagerWithDescriptions({ onComplete }: CastManagerProps) {
  const { 
    babyProfile,
    cast,
    uploadedPhotos,
    addCastMember,
    updateCastMember,
    addUploadedPhoto,
    storyData
  } = useBookStore();
  
  const [currentPhotoUpload, setCurrentPhotoUpload] = useState<{
    id: string;
    url: string;
    selectedCharacters: PersonId[];
    notes: string;
  } | null>(null);
  
  const [activeCastMembers, setActiveCastMembers] = useState<PersonId[]>(['baby']);
  const [inputMode, setInputMode] = useState<InputMode>('choice');
  const [selectedCharacterForDescription, setSelectedCharacterForDescription] = useState<PersonId | null>(null);
  const [showPrivacyNote, setShowPrivacyNote] = useState(true);
  const [characterDescriptions, setCharacterDescriptions] = useState<Partial<Record<PersonId, string>>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize character descriptions from cast
  useEffect(() => {
    const initialDescriptions: Partial<Record<PersonId, string>> = {};
    activeCastMembers.forEach(charId => {
      if (cast[charId]?.features_lock) {
        initialDescriptions[charId] = cast[charId].features_lock!;
      }
    });
    if (Object.keys(initialDescriptions).length > 0) {
      setCharacterDescriptions(prev => ({ ...prev, ...initialDescriptions }));
    }
  }, [cast, activeCastMembers]);
  
  // Extract characters from story if available
  useEffect(() => {
    if (storyData?.cast_members) {
      const storyCharacters = storyData.cast_members as PersonId[];
      setActiveCastMembers(prev => {
        const combined = new Set([...prev, ...storyCharacters]);
        return Array.from(combined);
      });
    }
  }, [storyData]);
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo must be less than 10MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setCurrentPhotoUpload({
        id: uuidv4(),
        url,
        selectedCharacters: [],
        notes: ''
      });
    };
    reader.readAsDataURL(file);
  };
  
  const toggleCharacterInPhoto = (characterId: PersonId) => {
    if (!currentPhotoUpload) return;
    
    setCurrentPhotoUpload(prev => {
      if (!prev) return prev;
      
      const updated = prev.selectedCharacters.includes(characterId)
        ? prev.selectedCharacters.filter(id => id !== characterId)
        : [...prev.selectedCharacters, characterId];
      
      return {
        ...prev,
        selectedCharacters: updated
      };
    });
  };
  
  const savePhotoWithTags = () => {
    if (!currentPhotoUpload || currentPhotoUpload.selectedCharacters.length === 0) {
      toast.error('Please select at least one character in this photo');
      return;
    }
    
    const isSoloShot = currentPhotoUpload.selectedCharacters.length === 1;
    
    const uploadedPhoto: UploadedPhoto = {
      id: currentPhotoUpload.id,
      fileUrl: currentPhotoUpload.url,
      people: currentPhotoUpload.selectedCharacters,
      is_identity_anchor: isSoloShot,
      is_group_photo: currentPhotoUpload.selectedCharacters.length > 1,
      notes: currentPhotoUpload.notes
    };
    
    addUploadedPhoto(uploadedPhoto);
    
    currentPhotoUpload.selectedCharacters.forEach(charId => {
      if (!cast[charId]) {
        const charOption = CHARACTER_OPTIONS.find(opt => opt.id === charId);
        addCastMember({
          id: charId,
          displayName: charId === 'baby' ? babyProfile?.baby_name || 'Baby' : charOption?.label || charId,
          fallbackPhotos: [currentPhotoUpload.url],
          identityAnchorUrl: isSoloShot ? currentPhotoUpload.url : undefined
        });
      } else if (isSoloShot && !cast[charId]?.identityAnchorUrl) {
        updateCastMember(charId, {
          identityAnchorUrl: currentPhotoUpload.url
        });
      }
    });
    
    setCurrentPhotoUpload(null);
    setInputMode('choice');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDeletePhoto = (photoId: string) => {
    // Confirmation dialog
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }
    
    // Find the photo to delete
    const photoToDelete = uploadedPhotos.find(p => p.id === photoId);
    if (!photoToDelete) return;
    
    // Remove from uploadedPhotos in store
    const updatedPhotos = uploadedPhotos.filter(p => p.id !== photoId);
    
    // Update the store (we need to add a removeUploadedPhoto function to the store)
    // For now, we'll work around it by resetting all photos
    useBookStore.setState({
      uploadedPhotos: updatedPhotos
    });
    
    // Update cast members if this was their only photo
    photoToDelete.people.forEach(charId => {
      const remainingPhotos = updatedPhotos.filter(p => p.people.includes(charId));
      if (remainingPhotos.length === 0) {
        // Remove identity anchor if this was it
        if (cast[charId]?.identityAnchorUrl === photoToDelete.fileUrl) {
          updateCastMember(charId, {
            identityAnchorUrl: undefined,
            fallbackPhotos: []
          });
        }
      } else {
        // Update to use another photo as identity anchor if needed
        const soloPhoto = remainingPhotos.find(p => p.people.length === 1);
        if (soloPhoto && cast[charId]) {
          updateCastMember(charId, {
            identityAnchorUrl: soloPhoto.fileUrl,
            fallbackPhotos: remainingPhotos.map(p => p.fileUrl)
          });
        }
      }
    });
  };
  
  const handleDeleteDescription = (charId: PersonId) => {
    const charOption = CHARACTER_OPTIONS.find(c => c.id === charId);
    const charName = charId === 'baby' ? babyProfile?.baby_name : charOption?.label;
    
    // Confirmation dialog
    if (!confirm(`Are you sure you want to delete the description for ${charName}?`)) {
      return;
    }
    
    // Remove from local state
    setCharacterDescriptions(prev => {
      const newDescriptions = { ...prev };
      delete newDescriptions[charId];
      return newDescriptions;
    });
    
    // Remove from cast member
    if (cast[charId]) {
      updateCastMember(charId, {
        features_lock: undefined
      });
    }
  };
  
  const handleDescriptionSave = (description: string, metadata: any) => {
    if (!selectedCharacterForDescription) return;
    
    // Save description to local state
    setCharacterDescriptions(prev => ({
      ...prev,
      [selectedCharacterForDescription]: description
    }));
    
    // Update cast member with description
    const charOption = CHARACTER_OPTIONS.find(opt => opt.id === selectedCharacterForDescription);
    if (!cast[selectedCharacterForDescription]) {
      addCastMember({
        id: selectedCharacterForDescription,
        displayName: selectedCharacterForDescription === 'baby' 
          ? babyProfile?.baby_name || 'Baby' 
          : charOption?.label || selectedCharacterForDescription,
        fallbackPhotos: [],
        features_lock: description // Store description in features_lock field
      });
    } else {
      updateCastMember(selectedCharacterForDescription, {
        features_lock: description
      });
    }
    
    // No toast - just close modal
    setSelectedCharacterForDescription(null);
    setInputMode('choice');
  };
  
  const getCharacterStats = () => {
    const stats: Partial<Record<PersonId, { 
      photoCount: number; 
      hasSoloShot: boolean; 
      hasDescription: boolean;
      hasAnyInput: boolean;
    }>> = {};
    
    activeCastMembers.forEach(charId => {
      const photos = uploadedPhotos.filter(p => p.people.includes(charId));
      const hasSoloShot = photos.some(p => p.people.length === 1);
      const hasDescription = !!characterDescriptions[charId] || !!cast[charId]?.features_lock;
      
      stats[charId] = {
        photoCount: photos.length,
        hasSoloShot,
        hasDescription,
        hasAnyInput: photos.length > 0 || hasDescription
      };
    });
    
    return stats;
  };
  
  const stats = getCharacterStats();
  const allCharactersHaveInput = activeCastMembers.every(
    charId => {
      const charStats = stats[charId];
      return charStats ? charStats.hasAnyInput : false;
    }
  );
  
  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-4">
      {/* Header */}
      <div className="card-magical text-center">
        <div className="inline-flex p-3 sm:p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-3 sm:mb-4">
          <Users className="h-10 w-10 sm:h-12 sm:w-12 text-purple-600" />
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-patrick gradient-text mb-2 sm:mb-3 px-2">
          Create Your Characters
        </h2>
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-2">
          Upload photos or describe characters for your story
        </p>
        
        {/* Privacy Note */}
        {showPrivacyNote && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-200 relative mx-2"
          >
            <button
              onClick={() => setShowPrivacyNote(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
            <div className="flex items-start gap-2 sm:gap-3">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-left pr-6">
                <p className="text-xs sm:text-sm text-blue-900 font-medium mb-1">
                  Privacy Option Available
                </p>
                <p className="text-xs sm:text-sm text-blue-700">
                  No photos? No problem! Describe how each character looks and our AI will create
                  consistent illustrations based on your descriptions. Perfect for privacy!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Active Cast Members */}
      <div className="card-magical">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
          <h3 className="text-xl sm:text-2xl font-patrick">Characters in Your Story</h3>
          <div className="text-xs sm:text-sm text-gray-600">
            {activeCastMembers.filter(id => stats[id]?.hasAnyInput).length} of {activeCastMembers.length} complete
          </div>
        </div>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
          Add a photo or description for each character. You can mix and match!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {activeCastMembers.map(charId => {
            const charOption = CHARACTER_OPTIONS.find(opt => opt.id === charId);
            if (!charOption) return null;
            
            const Icon = charOption.icon;
            const charStats = stats[charId];
            const photoCount = charStats ? charStats.photoCount : 0;
            const hasDescription = charStats ? charStats.hasDescription : false;
            const hasAnyInput = charStats ? charStats.hasAnyInput : false;
            
            return (
              <motion.div
                key={charId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.03 }}
                className={`relative p-6 sm:p-8 rounded-xl sm:rounded-2xl border-2 sm:border-3 text-center transition-all ${
                  hasAnyInput
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                {!hasAnyInput && (
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                    <span className="text-red-500 text-[10px] sm:text-xs font-medium">
                      Needs input
                    </span>
                  </div>
                )}

                <div className={`inline-flex p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br ${charOption.gradient} mb-3 sm:mb-4 mx-auto`}>
                  <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>

                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  {charId === 'baby' ? babyProfile?.baby_name : charOption.label}
                </h3>
                
                <div className="space-y-1 text-xs sm:text-sm">
                  {photoCount > 0 && (
                    <p className="text-gray-600">
                      <Camera className="inline h-3 w-3 mr-1" />
                      {photoCount} photo{photoCount !== 1 ? 's' : ''}
                    </p>
                  )}
                  {hasDescription && (
                    <p className="text-purple-600 font-medium">
                      <FileText className="inline h-3 w-3 mr-1" />
                      Has description
                    </p>
                  )}
                </div>

                {!hasAnyInput && (
                  <button
                    onClick={() => {
                      setSelectedCharacterForDescription(charId);
                      setInputMode('describe');
                    }}
                    className="btn-secondary text-[10px] sm:text-xs mt-2 sm:mt-3 px-2 sm:px-3 py-1"
                  >
                    Quick Describe
                  </button>
                )}
                
                {hasDescription && (
                  <div className="flex gap-2 justify-center mt-2">
                    <button
                      onClick={() => {
                        setSelectedCharacterForDescription(charId);
                        setInputMode('describe');
                      }}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      <Edit2 className="inline h-3 w-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDescription(charId)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="inline h-3 w-3 mr-1" />
                      Clear
                    </button>
                  </div>
                )}
                
                {hasAnyInput && photoCount > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        const charName = charId === 'baby' ? babyProfile?.baby_name : charOption.label;
                        if (confirm(`Clear all photos for ${charName}?`)) {
                          // Clear photos for this character
                          const photosToDelete = uploadedPhotos.filter(p => 
                            p.people.includes(charId) && p.people.length === 1
                          );
                          photosToDelete.forEach(p => {
                            const updatedPhotos = uploadedPhotos.filter(photo => photo.id !== p.id);
                            useBookStore.setState({ uploadedPhotos: updatedPhotos });
                          });
                          // Clear from cast
                          updateCastMember(charId, {
                            identityAnchorUrl: undefined,
                            fallbackPhotos: []
                          });
                        }
                      }}
                      className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                    >
                      Clear Photos
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Input Section */}
      <div className="card-magical">
        <h3 className="text-xl sm:text-2xl font-patrick mb-4 sm:mb-6">Add Character Details</h3>

        {inputMode === 'choice' && !currentPhotoUpload && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Upload Photo Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setInputMode('upload')}
              className="cursor-pointer"
            >
              <div className="border-2 sm:border-3 border-dashed border-purple-300 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-purple-500 transition-all hover:bg-purple-50 text-center">
                <Camera className="h-12 w-12 sm:h-16 sm:w-16 text-purple-400 mx-auto mb-3 sm:mb-4" />
                <h4 className="text-lg sm:text-xl font-semibold mb-2">Upload Photo</h4>
                <p className="text-xs sm:text-sm text-gray-600">
                  Use real photos for authentic illustrations
                </p>
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs">
                    Most Realistic
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs">
                    Best Results
                  </span>
                </div>
              </div>
            </motion.div>
            
            {/* Describe Character Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedCharacterForDescription(
                  activeCastMembers.find(id => !stats[id]?.hasAnyInput) || 'baby'
                );
                setInputMode('describe');
              }}
              className="cursor-pointer"
            >
              <div className="border-2 sm:border-3 border-dashed border-pink-300 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-pink-500 transition-all hover:bg-pink-50 text-center">
                <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-pink-400 mx-auto mb-3 sm:mb-4" />
                <h4 className="text-lg sm:text-xl font-semibold mb-2">Describe Character</h4>
                <p className="text-xs sm:text-sm text-gray-600">
                  Use detailed descriptions for privacy
                </p>
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] sm:text-xs">
                    100% Private
                  </span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] sm:text-xs">
                    AI Generated
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Upload Mode */}
        {inputMode === 'upload' && !currentPhotoUpload && (
          <div>
            <label className="block cursor-pointer">
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="border-2 sm:border-3 border-dashed border-purple-300 rounded-xl sm:rounded-2xl p-8 sm:p-12 hover:border-purple-500 transition-all hover:bg-purple-50"
              >
                <Upload className="h-16 w-16 sm:h-20 sm:w-20 text-purple-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-lg sm:text-xl font-medium text-center mb-2">
                  Click to Upload Photo
                </p>
                <p className="text-xs sm:text-sm text-gray-500 text-center">
                  JPG, PNG or WebP (max 10MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </motion.div>
            </label>
            <button
              onClick={() => setInputMode('choice')}
              className="btn-secondary mt-4"
            >
              Back to Options
            </button>
          </div>
        )}
        
        {/* Photo Upload Processing */}
        {currentPhotoUpload && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <img
                src={currentPhotoUpload.url}
                alt="Upload preview"
                className="w-full sm:w-48 h-48 rounded-xl object-cover"
              />

              <div className="flex-1">
                <h4 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Who's in this photo?</h4>
                <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                  Select all people visible in this photo
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 sm:mb-4">
                  {CHARACTER_OPTIONS.map(option => {
                    const Icon = option.icon;
                    const isSelected = currentPhotoUpload.selectedCharacters.includes(option.id);
                    const isActive = activeCastMembers.includes(option.id);
                    
                    if (!isActive && option.id !== 'baby') return null;
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleCharacterInPhoto(option.id)}
                        className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm">
                          {option.id === 'baby' ? babyProfile?.baby_name : option.label}
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-purple-600 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                
                {currentPhotoUpload.selectedCharacters.length === 1 && (
                  <p className="text-sm text-green-600 mb-3">
                    ✨ Great! Solo photos work best for character consistency
                  </p>
                )}
                {currentPhotoUpload.selectedCharacters.length > 1 && (
                  <p className="text-sm text-blue-600 mb-3">
                    📸 Group photo - good for showing relationships
                  </p>
                )}
                
                <input
                  type="text"
                  placeholder="Optional notes (e.g., beach vacation, birthday party)"
                  value={currentPhotoUpload.notes}
                  onChange={(e) => setCurrentPhotoUpload(prev => 
                    prev ? { ...prev, notes: e.target.value } : prev
                  )}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={savePhotoWithTags}
                disabled={currentPhotoUpload.selectedCharacters.length === 0}
                className="btn-primary flex-1 flex items-center justify-center py-2 sm:py-3"
              >
                <Check className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm sm:text-base">Save Photo</span>
              </button>
              <button
                onClick={() => {
                  setCurrentPhotoUpload(null);
                  setInputMode('choice');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="btn-secondary flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm sm:text-base">Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Character Description Modal */}
      <AnimatePresence>
        {inputMode === 'describe' && selectedCharacterForDescription && (
          <CharacterDescriptionModal
            characterId={selectedCharacterForDescription}
            characterName={
              selectedCharacterForDescription === 'baby' 
                ? babyProfile?.baby_name || 'Baby'
                : CHARACTER_OPTIONS.find(c => c.id === selectedCharacterForDescription)?.label || ''
            }
            gender={selectedCharacterForDescription === 'baby' ? babyProfile?.gender : undefined}
            existingDescription={
              characterDescriptions[selectedCharacterForDescription] || 
              cast[selectedCharacterForDescription]?.features_lock || ''
            }
            onSave={handleDescriptionSave}
            onCancel={() => {
              setSelectedCharacterForDescription(null);
              setInputMode('choice');
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Character Gallery */}
      {(uploadedPhotos.length > 0 || Object.keys(characterDescriptions).length > 0) && (
        <div className="card-magical">
          <h3 className="text-xl sm:text-2xl font-patrick mb-3 sm:mb-4">
            Your Character Library
          </h3>

          {/* Photos */}
          {uploadedPhotos.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h4 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                Photos ({uploadedPhotos.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {uploadedPhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <div className="relative overflow-hidden rounded-lg">
                      <img 
                        src={photo.fileUrl}
                        alt="Uploaded"
                        className="w-full aspect-square object-cover transition-transform group-hover:scale-105"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 rounded-b-lg">
                      <p className="text-xs">
                        {photo.people.map(pid => {
                          const char = CHARACTER_OPTIONS.find(c => c.id === pid);
                          return pid === 'baby' ? babyProfile?.baby_name : char?.label;
                        }).join(', ')}
                      </p>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110"
                      title="Delete photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Descriptions */}
          {(Object.keys(characterDescriptions).length > 0 || 
            activeCastMembers.some(id => cast[id]?.features_lock)) && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Character Descriptions
              </h4>
              <div className="space-y-3">
                {activeCastMembers.map(charId => {
                  const description = characterDescriptions[charId] || cast[charId]?.features_lock;
                  if (!description) return null;
                  
                  const charOption = CHARACTER_OPTIONS.find(c => c.id === charId);
                  const Icon = charOption?.icon || User;
                  
                  return (
                    <div key={charId} className="p-4 bg-gray-50 rounded-lg group relative">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${charOption?.gradient || 'from-gray-400 to-gray-600'}`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold mb-1">
                            {charId === 'baby' ? babyProfile?.baby_name : charOption?.label}
                          </h5>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedCharacterForDescription(charId);
                              setInputMode('describe');
                            }}
                            className="text-purple-600 hover:text-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit description"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDescription(charId)}
                            className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete description"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Continue Button */}
      <div className="flex justify-center">
        <button
          onClick={onComplete}
          disabled={!allCharactersHaveInput}
          className="btn-primary text-sm sm:text-base lg:text-xl px-6 sm:px-8 lg:px-10 py-3 sm:py-4 w-full sm:w-auto"
        >
          {allCharactersHaveInput
            ? 'Continue to Illustrations'
            : `Add details for all characters (${
                activeCastMembers.filter(id => {
                  const charStats = stats[id];
                  return !charStats || !charStats.hasAnyInput;
                }).length
              } missing)`
          }
        </button>
      </div>
    </div>
  );
}