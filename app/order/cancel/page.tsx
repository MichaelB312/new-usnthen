'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, Home, ArrowLeft, HelpCircle } from 'lucide-react';

export default function OrderCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-white">
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
            className="inline-flex items-center justify-center w-24 h-24 bg-orange-100 rounded-full mb-6"
          >
            <XCircle className="h-16 w-16 text-orange-600" />
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-patrick text-gray-800 mb-4">
            Order Cancelled
          </h1>

          <p className="text-xl text-gray-700 mb-3">
            Your order was not completed
          </p>

          <p className="text-gray-600 mb-8">
            Don't worry! Your beautiful storybook is still waiting for you.
            You can complete your order anytime.
          </p>

          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <h2 className="font-semibold text-lg mb-2">Need help?</h2>
                <p className="text-gray-700 text-sm">
                  If you encountered any issues during checkout or have questions about pricing,
                  feel free to reach out to our support team at support@usandthen.com
                </p>
              </div>
            </div>
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
              onClick={() => router.back()}
              className="btn-primary flex items-center justify-center gap-2 flex-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Book
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
