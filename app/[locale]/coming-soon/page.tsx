'use client';

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
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT SIDE - Brand & Message */}
      <div className="h-1/2 lg:h-full lg:w-1/2 bg-gradient-to-br from-amber-50 via-orange-50 to-pink-100 relative flex items-center justify-center p-8 lg:p-16">
        {/* Playful decorative shapes */}
        <div className="absolute top-10 right-16 w-32 h-32 bg-yellow-200/40 rounded-full" />
        <div className="absolute top-32 right-32 w-20 h-20 bg-pink-200/50 rounded-full" />
        <div className="absolute bottom-24 left-16 w-40 h-40 bg-purple-200/30 rounded-full" />
        <div className="absolute bottom-32 left-40 w-24 h-24 bg-blue-200/40 rounded-full" />

        {/* Fun wavy shape */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20">
          <svg viewBox="0 0 1200 800" className="w-full h-full">
            <path d="M 0 400 Q 300 300 600 400 T 1200 400 L 1200 800 L 0 800 Z" fill="#FCD34D" opacity="0.3" />
            <path d="M 0 500 Q 300 450 600 500 T 1200 500 L 1200 800 L 0 800 Z" fill="#F9A8D4" opacity="0.3" />
          </svg>
        </div>

        {/* Simple star decorations */}
        <div className="absolute top-20 left-20 text-yellow-400 text-2xl">★</div>
        <div className="absolute top-40 left-32 text-pink-400 text-xl">★</div>
        <div className="absolute bottom-40 right-20 text-purple-400 text-2xl">★</div>
        <div className="absolute top-1/2 right-20 text-blue-300 text-lg">★</div>

        <div className="relative z-10 max-w-2xl">
          {/* Large COMING SOON text with playful styling */}
          <div className="mb-8 lg:mb-12">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black leading-none tracking-tight mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500">
                COMING
              </span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                SOON
              </span>
            </h1>
            {/* Playful wavy underline */}
            <svg viewBox="0 0 200 20" className="w-32 lg:w-40 h-3">
              <path d="M 0 10 Q 25 5 50 10 T 100 10 T 150 10 T 200 10" stroke="#F472B6" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          {/* Brand name */}
          <div className="space-y-3 lg:space-y-4">
            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-800">
              Us & Then
            </h2>
            <p className="text-lg lg:text-xl xl:text-2xl text-gray-700 max-w-lg leading-relaxed">
              Transform your precious memories into beautifully illustrated storybooks
            </p>
          </div>

          {/* Fun decorative element */}
          <div className="mt-8 lg:mt-12 flex items-center gap-3">
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-pink-400 rounded-full" />
              <div className="w-3 h-3 bg-purple-400 rounded-full" />
              <div className="w-3 h-3 bg-blue-400 rounded-full" />
            </div>
            <span className="text-gray-600 text-sm lg:text-base font-medium">Magical AI Stories</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Email Form */}
      <div className="h-1/2 lg:h-full lg:w-1/2 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative flex items-center justify-center p-8 lg:p-16">
        {/* Playful shapes and decorations */}
        <div className="absolute top-16 left-16 w-24 h-24 bg-blue-200/40 rounded-3xl rotate-12" />
        <div className="absolute bottom-20 right-20 w-32 h-32 bg-pink-200/40 rounded-full" />
        <div className="absolute top-1/3 right-10 w-16 h-16 bg-purple-200/40 rounded-2xl -rotate-12" />

        {/* Cloud shapes */}
        <div className="absolute top-12 right-1/3">
          <div className="relative w-20 h-8 bg-white/60 rounded-full">
            <div className="absolute -top-2 left-4 w-12 h-12 bg-white/60 rounded-full" />
            <div className="absolute -top-1 right-4 w-10 h-10 bg-white/60 rounded-full" />
          </div>
        </div>

        {/* More small stars */}
        <div className="absolute top-24 left-32 text-blue-300 text-xl">★</div>
        <div className="absolute bottom-32 left-24 text-pink-300 text-lg">★</div>
        <div className="absolute top-1/2 left-12 text-purple-300 text-sm">★</div>

        <div className="relative z-10 w-full max-w-md">
          {!submitted ? (
            <div className="space-y-6">
              {/* Section header */}
              <div>
                <div className="inline-block px-5 py-2 bg-gradient-to-r from-pink-200 to-purple-200 rounded-full text-purple-800 text-sm font-bold mb-6 shadow-sm">
                  Join the Adventure!
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4 leading-tight">
                  Be the first to create magical stories
                </h3>
                <p className="text-gray-600 text-base lg:text-lg leading-relaxed">
                  Get notified when we launch and start your storytelling journey
                </p>
              </div>

              {/* Email form with playful styling */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-6 py-4 border-2 border-purple-200 rounded-2xl focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100 text-gray-800 placeholder:text-gray-400 text-base bg-white/80 backdrop-blur transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-bold text-base lg:text-lg rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                >
                  Notify Me!
                </button>
              </form>

              {/* Additional info */}
              <p className="text-xs text-gray-500 text-center pt-2">
                No spam, just magical updates
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success state */}
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-gray-800 mb-3">
                  You're on the list!
                </h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  Get ready for magical storytelling adventures
                </p>
                <div className="mt-6 text-4xl">✨🎨📚</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="absolute bottom-8 left-8 right-8 text-center">
            <p className="text-xs text-gray-500">© 2025 Us & Then</p>
          </div>
        </div>
      </div>
    </div>
  );
}
