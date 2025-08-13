'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Baby, Calendar, Camera, Sparkles, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ProfileFormProps {
  onComplete: (profile: any) => void;
}

export function ProfileForm({ onComplete }: ProfileFormProps) {
  const [babyName, setBabyName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Photo must be less than 10MB');
        return;
      }
      
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const calculateAgeGroup = (birthdate: string): string => {
    const birth = new Date(birthdate);
    const now = new Date();
    const ageInMonths = (now.getFullYear() - birth.getFullYear()) * 12 + 
                        (now.getMonth() - birth.getMonth());
    
    if (ageInMonths < 3) return 'newborn';
    if (ageInMonths < 6) return 'young_infant';
    if (ageInMonths < 12) return 'older_infant';
    if (ageInMonths < 24) return 'young_toddler';
    if (ageInMonths < 36) return 'older_toddler';
    if (ageInMonths < 60) return 'preschool';
    return 'early_reader';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!babyName || !birthdate || !gender) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const profile = {
        baby_name: babyName,
        birthdate: birthdate,
        gender: gender,
        age_group: calculateAgeGroup(birthdate),
        photo_file: photoFile,
        photo_preview: photoPreview
      };

      onComplete(profile);
    } catch (error) {
      toast.error('Failed to save profile');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-magical max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
          <Baby className="h-12 w-12 text-purple-600" />
        </div>
        <h2 className="text-4xl font-patrick gradient-text mb-3">
          Tell Us About Your Little One
        </h2>
        <p className="text-gray-600 text-lg">
          Let's start by getting to know your baby
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Baby's Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Baby's Name *
          </label>
          <div className="relative">
            <input
              type="text"
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
              className="input-magical pl-12"
              placeholder="Enter your baby's name..."
              required
            />
            <Baby className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
          </div>
        </div>

        {/* Birthdate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Birthdate *
          </label>
          <div className="relative">
            <input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="input-magical pl-12"
              max={format(new Date(), 'yyyy-MM-dd')}
              required
            />
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
          </div>
          {birthdate && (
            <p className="mt-2 text-sm text-gray-500">
              Age group: {calculateAgeGroup(birthdate).replace('_', ' ')}
            </p>
          )}
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Gender *
          </label>
          <div className="grid grid-cols-3 gap-4">
            {['boy', 'girl', 'neutral'].map((option) => (
              <motion.button
                key={option}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setGender(option)}
                className={`
                  py-3 px-4 rounded-2xl border-2 font-medium transition-all
                  ${gender === option 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-gray-200 hover:border-purple-300'}
                `}
              >
                {option === 'boy' ? '👦 Boy' : option === 'girl' ? '👧 Girl' : '🌟 Neutral'}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Baby's Photo (Optional)
          </label>
          <p className="text-sm text-gray-500 mb-4">
            Upload a photo to see your baby in the illustrations
          </p>
          
          {!photoPreview ? (
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-purple-300 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
            >
              <Upload className="h-12 w-12 text-purple-400 mx-auto mb-4" />
              <p className="text-gray-700 font-medium mb-2">
                Click to upload a photo
              </p>
              <p className="text-sm text-gray-500">
                JPG, PNG or WebP (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handlePhotoUpload}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
            </motion.div>
          ) : (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Baby preview"
                className="w-full h-64 object-cover rounded-2xl"
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={removePhoto}
                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-red-50"
              >
                <X className="h-5 w-5 text-red-500" />
              </motion.button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading || !babyName || !birthdate || !gender}
          className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              Saving Profile...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Continue to Memory Chat
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
