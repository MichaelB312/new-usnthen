'use client';

import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-white to-pink-50/30" />

      {/* Subtle floating element */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-100 rounded-full blur-3xl"
      />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl text-center">
        {/* Logo/Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="text-6xl md:text-8xl font-light tracking-tight text-gray-900 mb-6">
            Us & Then
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-xl md:text-2xl text-gray-600 font-light mb-16 leading-relaxed"
        >
          Your memories, transformed into beautiful illustrated storybooks
        </motion.p>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mb-12"
        >
          <span className="inline-block text-sm uppercase tracking-widest text-gray-400 mb-2">
            Coming Soon
          </span>
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-purple-300 to-transparent mx-auto" />
        </motion.div>

        {/* Email Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="max-w-md mx-auto"
        >
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 px-6 py-4 rounded-full border border-gray-200 focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all text-gray-900 placeholder:text-gray-400"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="px-8 py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
              >
                Notify Me
              </motion.button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8"
            >
              <p className="text-gray-600 font-light text-lg">
                Thank you. We'll be in touch.
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Hint at features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-20 text-sm text-gray-400 font-light space-y-1"
        >
          <p>AI-generated illustrations</p>
          <p className="text-gray-300">·</p>
          <p>Personalized narratives</p>
          <p className="text-gray-300">·</p>
          <p>Premium hardcover editions</p>
        </motion.div>
      </div>
    </div>
  );
}
