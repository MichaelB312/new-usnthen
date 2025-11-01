'use client';

import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Heart, Star } from 'lucide-react';
import { useState } from 'react';

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add email collection logic
    setSubmitted(true);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative flex items-center justify-center">
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-0 left-0 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-96 h-96 bg-pink-300/30 rounded-full blur-3xl"
        animate={{
          x: [0, -50, 0],
          y: [0, -100, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-300/20 rounded-full blur-3xl"
        animate={{
          x: [-128, -100, -128],
          y: [-128, -150, -128],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Floating particles */}
      <motion.div
        className="absolute top-[15%] left-[10%]"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 10, 0],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-purple-400" />
      </motion.div>
      <motion.div
        className="absolute top-[20%] right-[15%]"
        animate={{
          y: [0, 20, 0],
          rotate: [0, -15, 0],
          opacity: [0.4, 0.7, 0.4]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Heart className="h-5 w-5 md:h-7 md:w-7 text-pink-400 fill-pink-400/50" />
      </motion.div>
      <motion.div
        className="absolute bottom-[25%] left-[20%]"
        animate={{
          y: [0, -15, 0],
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Star className="h-5 w-5 md:h-6 md:w-6 text-yellow-400 fill-yellow-400/50" />
      </motion.div>
      <motion.div
        className="absolute bottom-[15%] right-[25%]"
        animate={{
          y: [0, 25, 0],
          rotate: [0, 20, 0],
          opacity: [0.4, 0.8, 0.4]
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-blue-400" />
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 p-6 sm:p-8 md:p-12"
        >
          {/* Icon with glow */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex justify-center mb-6 sm:mb-8"
          >
            <motion.div
              className="relative"
              animate={{
                boxShadow: [
                  '0 0 20px rgba(168, 85, 247, 0.4)',
                  '0 0 40px rgba(236, 72, 153, 0.6)',
                  '0 0 20px rgba(168, 85, 247, 0.4)',
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white" strokeWidth={2} />
              </div>
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center mb-3 sm:mb-4"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-2 sm:mb-3 tracking-tight">
              Us & Then
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-700 font-medium">
              Create Beautiful Memory Books
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center text-gray-600 text-sm sm:text-base md:text-lg mb-5 sm:mb-6 max-w-lg mx-auto leading-relaxed"
          >
            Transform precious memories into personalized, AI-illustrated storybooks
          </motion.p>

          {/* Coming Soon Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex justify-center mb-5 sm:mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200/50">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
              <span className="text-xs sm:text-sm text-purple-700 font-semibold tracking-wide">COMING SOON</span>
            </div>
          </motion.div>

          {/* Email Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="max-w-md mx-auto"
          >
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/90 border-2 border-purple-200/50 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100/50 transition-all text-gray-800 placeholder:text-gray-400 text-sm sm:text-base shadow-sm"
                />
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 10px 40px rgba(168, 85, 247, 0.3)' }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full px-6 py-3 sm:py-3.5 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-xl sm:rounded-2xl font-semibold shadow-lg transition-all duration-300 text-sm sm:text-base"
                >
                  Notify Me at Launch
                </motion.button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-5 sm:py-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl sm:rounded-2xl border border-purple-100"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white" />
                  </div>
                </motion.div>
                <p className="text-purple-700 font-bold text-base sm:text-lg mb-1">
                  You're on the list!
                </p>
                <p className="text-gray-600 text-xs sm:text-sm">
                  We'll notify you when we launch
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Simple feature tags */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-2 mt-6 sm:mt-8"
          >
            {['AI Illustrations', 'Your Story', 'Premium Books'].map((feature, i) => (
              <motion.span
                key={feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/50 backdrop-blur-sm rounded-full text-xs sm:text-sm text-gray-700 font-medium border border-white/60"
              >
                {feature}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center text-gray-500/80 text-xs sm:text-sm mt-4 sm:mt-6"
        >
          © 2025 Us & Then
        </motion.p>
      </div>
    </div>
  );
}
