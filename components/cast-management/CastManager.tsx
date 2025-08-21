// components/cast-management/CastManager.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Upload, Camera, Plus, X, Check, 
  User, Baby, Heart, Star, Crown
} from 'lucide-react';
import { useBookStore, PersonId, CastMember, UploadedPhoto } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface CastManagerProps {
  onComplete: () => void;
}

const CHARACTER_OPTIONS: { id: PersonId; label: string; icon: any; color: string }[] = [
  { id: 'baby', label: 'Baby', icon: Baby, color: 'from-pink-400 to-pink-600' },
  { id: 'mom', label: 'Mom', icon: Heart, color: 'from-purple-400 to-purple-600' },
  { id: 'dad', label: 'Dad', icon: User, color: 'from-blue-400 to-blue-600' },
  { id: 'grandma', label: 'Grandma', icon: Crown, color: 'from-amber-400 to-amber-600' },
  { id: 'grandpa', label: 'Grandpa', icon: Star, color: 'from-green-400 to-green-600' },
  { id: 'sibling', label: 'Sibling', icon: Users, color: 'from-teal-400 to-teal-600' },
  { id: 'aunt', label: 'Aunt', icon: Heart, color: 'from-rose-400 to-rose-600' },
  { id: 'uncle', label: 'Uncle', icon: User, color: 'from-indigo-400 to-indigo-600' },
  { id: 'friend', label: 'Friend', icon: Star, color: 'from-yellow-400 to-yellow-600' }
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
    isIdentityAnchor: boolean;
    isGroupPhoto: boolean;
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
        isIdentityAnchor: false,
        isGroupPhoto: false,
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
        selectedCharacters: updated,
        isGroupPhoto: updated.length > 1
      };
    });
  };
  
  const savePhotoWithTags = () => {
    if (!currentPhotoUpload || currentPhotoUpload.selectedCharacters.length === 0) {
      toast.error('Please select at least one character in this photo');
      return;
    }
    
    // Add photo to store
    const uploadedPhoto: UploadedPhoto = {
      id: currentPhotoUpload.id,
      fileUrl: currentPhotoUpload.url,
      people: currentPhotoUpload.selectedCharacters,
      is_identity_anchor: currentPhotoUpload.isIdentityAnchor,
      is_group_photo: currentPhotoUpload.isGroupPhoto,
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
          identityAnchorUrl: currentPhotoUpload.isIdentityAnchor ? currentPhotoUpload.url : undefined
        });
      } else if (currentPhotoUpload.isIdentityAnchor) {
        updateCastMember(charId, {
          identityAnchorUrl: currentPhotoUpload.url
        });
      }
    });
    
    toast.success(`Photo tagged with ${currentPhotoUpload.selectedCharacters.length} character(s)`);
    setCurrentPhotoUpload(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const getCharacterStats = () => {
    const stats: Partial<Record<PersonId, { photoCount: number; hasAnchor: boolean }>> = {};
    
    activeCastMembers.forEach(charId => {
      const photos = uploadedPhotos.filter(p => p.people.includes(charId));
      const hasAnchor = photos.some(p => p.is_identity_anchor) || !!cast[charId]?.identityAnchorUrl;
      
      stats[charId] = {
        photoCount: photos.length,
        hasAnchor
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
          Cast Management
        </h2>
        <p className="text-xl text-gray-600">
          Upload photos and tag who appears in each one for consistent character rendering
        </p>
      </div>
      
      {/* Active Cast Members */}
      <div className="card-magical">
        <h3 className="text-2xl font-patrick mb-4">Story Characters</h3>
        <p className="text-gray-600 mb-6">
          These characters appear in your story. Upload reference photos for each.
        </p>
        
        <div className="grid md:grid-cols-3 gap-4">
          {activeCastMembers.map(charId => {
            const charOption = CHARACTER_OPTIONS.find(opt => opt.id === charId);
            if (!charOption) return null;
            
            const Icon = charOption.icon;
            const charStats = stats[charId];
            const photoCount = charStats ? charStats.photoCount : 0;
            const hasAnchor = charStats ? charStats.hasAnchor : false;
            
            return (
              <motion.div
                key={charId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative p-6 rounded-2xl border-2 ${
                  photoCount > 0 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${charOption.color} mb-3`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                
                <h4 className="text-lg font-semibold mb-1">
                  {charId === 'baby' ? babyProfile?.baby_name : charOption.label}
                </h4>
                
                <div className="text-sm text-gray-600">
                  <p>{photoCount} photo(s)</p>
                  {hasAnchor && (
                    <p className="text-green-600 font-medium">✓ Has identity anchor</p>
                  )}
                </div>
                
                {photoCount === 0 && (
                  <div className="absolute top-2 right-2">
                    <span className="text-red-500 text-xs font-medium">Needs photo</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      
      {/* Photo Upload Section */}
      <div className="card-magical">
        <h3 className="text-2xl font-patrick mb-4">Upload Character Photos</h3>
        
        {!currentPhotoUpload ? (
          <label className="block cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="border-3 border-dashed border-purple-300 rounded-2xl p-12 hover:border-purple-500 transition-all hover:bg-purple-50"
            >
              <Camera className="h-20 w-20 text-purple-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-center mb-2">
                Click to Upload Character Photo
              </p>
              <p className="text-sm text-gray-500 text-center">
                Upload photos of family members who appear in the story
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
                
                {/* Photo Type Options */}
                <div className="space-y-2 mb-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={currentPhotoUpload.isIdentityAnchor}
                      onChange={(e) => setCurrentPhotoUpload(prev => 
                        prev ? { ...prev, isIdentityAnchor: e.target.checked } : prev
                      )}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">
                      Use as identity anchor (best front-facing shot for this character)
                    </span>
                  </label>
                  
                  {currentPhotoUpload.selectedCharacters.length > 1 && (
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={currentPhotoUpload.isGroupPhoto}
                        onChange={(e) => setCurrentPhotoUpload(prev => 
                          prev ? { ...prev, isGroupPhoto: e.target.checked } : prev
                        )}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">
                        Group photo (good for composition reference)
                      </span>
                    </label>
                  )}
                </div>
                
                {/* Notes */}
                <input
                  type="text"
                  placeholder="Notes (e.g., outfit details, location)"
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
                className="btn-primary flex-1"
              >
                <Check className="h-5 w-5 mr-2" />
                Save Photo with Tags
              </button>
              <button
                onClick={() => {
                  setCurrentPhotoUpload(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="btn-secondary"
              >
                <X className="h-5 w-5 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Uploaded Photos Gallery */}
      {uploadedPhotos.length > 0 && (
        <div className="card-magical">
          <h3 className="text-2xl font-patrick mb-4">
            Uploaded Photos ({uploadedPhotos.length})
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
                  {photo.is_identity_anchor && (
                    <span className="text-xs text-green-400">Identity Anchor</span>
                  )}
                  {photo.is_group_photo && (
                    <span className="text-xs text-blue-400">Group Photo</span>
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
            ? 'Continue to Image Generation' 
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