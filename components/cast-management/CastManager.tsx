// components/cast-management/CastManager.tsx - Simplified version
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Upload, Camera, Plus, X, Check, 
  User, Baby, Heart, Star, Crown, Sparkles
} from 'lucide-react';
import { useBookStore, PersonId, CastMember, UploadedPhoto } from '@/lib/store/bookStore';
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

export function CastManager({ onComplete }: CastManagerProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    // Determine if this is a good identity photo (solo shot)
    const isSoloShot = currentPhotoUpload.selectedCharacters.length === 1;
    
    // Add photo to store
    const uploadedPhoto: UploadedPhoto = {
      id: currentPhotoUpload.id,
      fileUrl: currentPhotoUpload.url,
      people: currentPhotoUpload.selectedCharacters,
      is_identity_anchor: isSoloShot, // Auto-set for solo shots
      is_group_photo: currentPhotoUpload.selectedCharacters.length > 1,
      notes: currentPhotoUpload.notes
    };
    
    addUploadedPhoto(uploadedPhoto);
    
    // Update cast members if needed
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
        // Update with better solo shot if we don't have one
        updateCastMember(charId, {
          identityAnchorUrl: currentPhotoUpload.url
        });
      }
    });
    
    const characterNames = currentPhotoUpload.selectedCharacters.map(id => {
      if (id === 'baby') return babyProfile?.baby_name || 'Baby';
      return CHARACTER_OPTIONS.find(opt => opt.id === id)?.label || id;
    }).join(', ');
    
    toast.success(`Photo saved with ${characterNames}`);
    setCurrentPhotoUpload(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const getCharacterStats = () => {
    const stats: Partial<Record<PersonId, { photoCount: number; hasSoloShot: boolean }>> = {};
    
    activeCastMembers.forEach(charId => {
      const photos = uploadedPhotos.filter(p => p.people.includes(charId));
      const hasSoloShot = photos.some(p => p.people.length === 1);
      
      stats[charId] = {
        photoCount: photos.length,
        hasSoloShot
      };
    });
    
    return stats;
  };
  
  const stats = getCharacterStats();
  const allCharactersHavePhotos = activeCastMembers.every(
    charId => {
      const charStats = stats[charId];
      return charStats ? charStats.photoCount > 0 : false;
    }
  );
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="card-magical text-center">
        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
          <Users className="h-12 w-12 text-purple-600" />
        </div>
        <h2 className="text-4xl font-patrick gradient-text mb-3">
          Upload Character Photos
        </h2>
        <p className="text-xl text-gray-600">
          Upload photos of each character who appears in your story
        </p>
        <p className="text-sm text-gray-500 mt-2">
          💡 Tip: Solo photos work best for consistent character generation
        </p>
      </div>
      
      {/* Active Cast Members */}
      <div className="card-magical">
        <h3 className="text-2xl font-patrick mb-4">Characters in Your Story</h3>
        <p className="text-gray-600 mb-6">
          Upload at least one photo for each character. Solo shots are preferred.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          {activeCastMembers.map(charId => {
            const charOption = CHARACTER_OPTIONS.find(opt => opt.id === charId);
            if (!charOption) return null;
            
            const Icon = charOption.icon;
            const charStats = stats[charId];
            const photoCount = charStats ? charStats.photoCount : 0;
            const hasSoloShot = charStats ? charStats.hasSoloShot : false;
            
            return (
              <motion.div
                key={charId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.03 }}
                className={`relative p-8 rounded-2xl border-3 text-center transition-all ${
                  photoCount > 0 
                    ? hasSoloShot 
                      ? 'border-green-400 bg-green-50' 
                      : 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                {photoCount === 0 && (
                  <div className="absolute top-3 right-3">
                    <span className="text-red-500 text-xs font-medium">
                      Needs photo
                    </span>
                  </div>
                )}
                
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${charOption.gradient} mb-4 mx-auto`}>
                  <Icon className="h-10 w-10 text-white" />
                </div>
                
                <h3 className="text-xl font-semibold mb-2">
                  {charId === 'baby' ? babyProfile?.baby_name : charOption.label}
                </h3>
                
                <p className="text-sm text-gray-600 mb-1">
                  {photoCount} photo{photoCount !== 1 ? 's' : ''}
                </p>
                
                {photoCount > 0 && (
                  <p className={`text-sm font-medium ${hasSoloShot ? 'text-green-600' : 'text-yellow-600'}`}>
                    {hasSoloShot ? '✓ Has solo shot' : '⚠ Group photo only'}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Photo Upload Section */}
      <div className="card-magical">
        <h3 className="text-2xl font-patrick mb-4">Add Photo</h3>
        
        {!currentPhotoUpload ? (
          <label className="block cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="border-3 border-dashed border-purple-300 rounded-2xl p-12 hover:border-purple-500 transition-all hover:bg-purple-50"
            >
              <Camera className="h-20 w-20 text-purple-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-center mb-2">
                Click to Upload Photo
              </p>
              <p className="text-sm text-gray-500 text-center">
                Upload clear photos of family members
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
        ) : (
          <div className="space-y-6">
            {/* Photo Preview */}
            <div className="flex gap-6">
              <img 
                src={currentPhotoUpload.url} 
                alt="Upload preview"
                className="w-48 h-48 rounded-xl object-cover"
              />
              
              <div className="flex-1">
                <h4 className="font-semibold mb-3">Who's in this photo?</h4>
                <p className="text-sm text-gray-500 mb-3">
                  Select all people visible in this photo
                </p>
                
                {/* Character Selection */}
                <div className="grid grid-cols-3 gap-2 mb-4">
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
                
                {/* Helper text */}
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
                
                {/* Optional notes */}
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
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={savePhotoWithTags}
                disabled={currentPhotoUpload.selectedCharacters.length === 0}
                className="btn-primary flex-1 flex items-center justify-center"
              >
                <Check className="h-5 w-5 mr-2" />
                <span>Save Photo</span>
              </button>
              <button
                onClick={() => {
                  setCurrentPhotoUpload(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="btn-secondary flex items-center justify-center px-6"
              >
                <X className="h-5 w-5 mr-2" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Uploaded Photos Gallery */}
      {uploadedPhotos.length > 0 && (
        <div className="card-magical">
          <h3 className="text-2xl font-patrick mb-4">
            Your Photos ({uploadedPhotos.length})
          </h3>
          
          <div className="grid md:grid-cols-4 gap-4">
            {uploadedPhotos.map(photo => (
              <div key={photo.id} className="relative group">
                <img 
                  src={photo.fileUrl}
                  alt="Uploaded"
                  className="w-full aspect-square rounded-lg object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 rounded-b-lg">
                  <p className="text-xs">
                    {photo.people.map(pid => {
                      const char = CHARACTER_OPTIONS.find(c => c.id === pid);
                      return pid === 'baby' ? babyProfile?.baby_name : char?.label;
                    }).join(', ')}
                  </p>
                  {photo.people.length === 1 && (
                    <span className="text-xs text-green-400">Best for consistency</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Continue Button */}
      <div className="flex justify-center">
        <button
          onClick={onComplete}
          disabled={!allCharactersHavePhotos}
          className="btn-primary text-xl px-10 py-4"
        >
          {allCharactersHavePhotos 
            ? 'Continue to Style Selection' 
            : `Upload photos for all characters (${
                activeCastMembers.filter(id => {
                  const charStats = stats[id];
                  return !charStats || charStats.photoCount === 0;
                }).length
              } missing)`
          }
        </button>
      </div>
    </div>
  );
}