'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Baby, Calendar, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface ProfileFormProps {
  onComplete: (profile: any) => void;
}

export function ProfileForm({ onComplete }: ProfileFormProps) {
  const [babyName, setBabyName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);

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
        age_group: calculateAgeGroup(birthdate)
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
          <div className="grid grid-cols-2 gap-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setGender('boy')}
              className={`
                py-4 px-6 rounded-2xl border-2 font-semibold text-lg transition-all
                ${gender === 'boy'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}
              `}
            >
              Boy
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setGender('girl')}
              className={`
                py-4 px-6 rounded-2xl border-2 font-semibold text-lg transition-all
                ${gender === 'girl'
                  ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-lg'
                  : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50/50'}
              `}
            >
              Girl
            </motion.button>
          </div>
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
