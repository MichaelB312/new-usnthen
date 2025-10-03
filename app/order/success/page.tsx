'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Home, BookOpen, ArrowRight } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      {showConfetti && <Confetti width={width} height={height} />}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <div className="card-magical text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6"
          >
            <CheckCircle className="h-16 w-16 text-green-600" />
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-patrick gradient-text mb-4">
            Order Confirmed!
          </h1>

          <p className="text-xl text-gray-700 mb-3">
            Your magical storybook is on its way!
          </p>

          <p className="text-gray-600 mb-8">
            We'll send you an email confirmation with tracking details once your book ships.
            {sessionId && (
              <span className="block mt-2 text-sm text-gray-500">
                Order ID: {sessionId.slice(-8)}
              </span>
            )}
          </p>

          <div className="bg-purple-50 rounded-lg p-6 mb-8">
            <h2 className="font-semibold text-lg mb-3">What happens next?</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600">1.</span>
                <span>Your book is being printed on premium quality paper</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">2.</span>
                <span>Carefully bound with a beautiful hardcover</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">3.</span>
                <span>Shipped to your door within 7-10 business days</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push('/')}
              className="btn-ghost flex items-center justify-center gap-2 flex-1"
            >
              <Home className="h-5 w-5" />
              Back to Home
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary flex items-center justify-center gap-2 flex-1"
            >
              <BookOpen className="h-5 w-5" />
              View My Books
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
