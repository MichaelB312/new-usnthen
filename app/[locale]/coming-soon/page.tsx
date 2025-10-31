'use client';

import { motion } from 'framer-motion';
import { Sparkles, Heart, BookOpen, Mail } from 'lucide-react';
import { useState } from 'react';

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add email collection logic
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-20 -left-20 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-20 -right-20 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, -30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl"
        />
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-4xl w-full"
      >
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 rounded-full blur-xl opacity-50"
            />
            <div className="relative bg-white p-6 rounded-full shadow-2xl">
              <BookOpen className="w-16 h-16 text-purple-600" />
            </div>
          </div>
        </motion.div>

        {/* Main heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-6"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Us & Then
            </span>
          </h1>
          <div className="flex items-center justify-center gap-3 text-xl md:text-2xl text-gray-700 font-medium">
            <Heart className="w-6 h-6 text-pink-500 animate-pulse" />
            <span>Transform Memories into Magic</span>
            <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-gray-600 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Turn your precious baby memories into beautifully illustrated, personalized storybooks.
          AI-powered magic meets heartfelt storytelling.
        </motion.p>

        {/* Coming Soon Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="flex justify-center mb-12"
        >
          <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 p-[2px] rounded-full">
            <div className="bg-white px-8 py-3 rounded-full">
              <p className="text-transparent bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text font-bold text-lg">
                Coming Very Soon ✨
              </p>
            </div>
          </div>
        </motion.div>

        {/* Email signup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="max-w-md mx-auto"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-purple-100">
            <h3 className="text-2xl font-semibold text-gray-800 mb-2 text-center">
              Be the First to Know
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Join our waitlist for exclusive early access
            </p>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-gray-800"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  Notify Me
                </motion.button>
              </form>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-600 font-semibold text-lg">Thank you for joining!</p>
                <p className="text-gray-600 mt-2">We'll be in touch soon</p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Features preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto"
        >
          {[
            { icon: '🎨', title: 'AI Illustrations', desc: 'Beautiful paper-collage art' },
            { icon: '📖', title: 'Your Story', desc: 'Personalized narratives' },
            { icon: '💝', title: 'Hardcover Books', desc: 'Premium quality printing' },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 + index * 0.1 }}
              className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center border border-purple-100"
            >
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h4 className="font-semibold text-gray-800 mb-1">{feature.title}</h4>
              <p className="text-sm text-gray-600">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mt-16 text-center text-gray-500 text-sm"
        >
          <p>© 2025 Us & Then. Crafted with love and AI.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
