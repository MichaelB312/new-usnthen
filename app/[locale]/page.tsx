'use client';

import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-100/40 via-pink-50/30 to-purple-50/40 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-3xl">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-white/50 p-8 sm:p-10 md:p-16">
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6 sm:mb-8"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={1.5} />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-center mb-4 sm:mb-6"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3 sm:mb-4">
              Us & Then
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-700 font-medium">
              Create Beautiful Memory Books
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-center text-gray-600 text-base sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto leading-relaxed px-2"
          >
            Transform your precious memories into personalized, illustrated storybooks.
            Powered by AI, crafted with love.
          </motion.p>

          {/* Divider */}
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
            <span className="mx-3 sm:mx-4 text-xs sm:text-sm text-purple-400 font-medium tracking-wider">COMING SOON</span>
            <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-pink-300 to-transparent" />
          </div>

          {/* Email Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="max-w-md mx-auto mb-10"
          >
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full px-6 py-4 rounded-xl bg-white/80 border-2 border-purple-200 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all text-gray-800 placeholder:text-gray-400"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  Get Notified
                </motion.button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 bg-purple-50 rounded-xl"
              >
                <p className="text-purple-700 font-semibold text-lg">
                  Thank you for joining our waitlist!
                </p>
                <p className="text-gray-600 mt-2">
                  We'll notify you when we launch.
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 md:gap-6 text-center"
          >
            <div className="px-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">AI Illustrations</h3>
              <p className="text-xs sm:text-sm text-gray-600">Beautiful paper-collage artwork</p>
            </div>

            <div className="px-4">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Your Story</h3>
              <p className="text-xs sm:text-sm text-gray-600">Personalized narratives</p>
            </div>

            <div className="px-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">Hardcover Books</h3>
              <p className="text-xs sm:text-sm text-gray-600">Premium printed editions</p>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center text-gray-500 text-sm mt-8"
        >
          © 2025 Us & Then
        </motion.p>
      </div>
    </div>
  );
}
