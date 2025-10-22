'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CheckCircle, Home, BookOpen, ArrowRight } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

function OrderSuccessContent() {
  const router = useRouter();
  const t = useTranslations();
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
            {t('orderSuccess.title')}
          </h1>

          <p className="text-xl text-gray-700 mb-3">
            {t('orderSuccess.subtitle')}
          </p>

          <p className="text-gray-600 mb-8">
            {t('orderSuccess.emailConfirmation')}
            {sessionId && (
              <span className="block mt-2 text-sm text-gray-500">
                {t('orderSuccess.orderId', {id: sessionId.slice(-8)})}
              </span>
            )}
          </p>

          <div className="bg-purple-50 rounded-lg p-6 mb-8">
            <h2 className="font-semibold text-lg mb-3">{t('orderSuccess.whatHappensNext')}</h2>
            <ul className="text-left space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600">1.</span>
                <span>{t('orderSuccess.steps.printing')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">2.</span>
                <span>{t('orderSuccess.steps.binding')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">3.</span>
                <span>{t('orderSuccess.steps.shipping')}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push('/')}
              className="btn-ghost flex items-center justify-center gap-2 flex-1"
            >
              <Home className="h-5 w-5" />
              {t('orderSuccess.backToHome')}
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary flex items-center justify-center gap-2 flex-1"
            >
              <BookOpen className="h-5 w-5" />
              {t('orderSuccess.viewMyBooks')}
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
