'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, BookOpen, Home } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';

export default function DashboardPage() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const { storyData, babyProfile } = useBookStore();

  useEffect(() => {
    // Check if there's a current book in progress
    if (storyData && babyProfile) {
      setBooks([{
        id: '1',
        title: storyData.title || 'Your Story',
        baby_name: babyProfile.baby_name,
        created_at: new Date().toISOString()
      }]);
    }
  }, [storyData, babyProfile]);

  return (
    <div className="min-h-screen p-4 sm:p-6 pt-20 sm:pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
          <button
            onClick={() => router.push('/')}
            className="btn-ghost flex items-center gap-2 text-sm sm:text-base"
          >
            <Home className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Home</span>
          </button>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-patrick gradient-text order-first sm:order-none w-full sm:w-auto text-center">My Storybooks</h1>

          <Link href="/create" className="btn-primary flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto py-2 sm:py-2.5 px-4 sm:px-6">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="whitespace-nowrap">Create New Book</span>
          </Link>
        </div>

        {books.length === 0 ? (
          <div className="card-magical text-center py-12 sm:py-16 lg:py-20 px-4">
            <BookOpen className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">No books yet</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Create your first magical storybook!</p>
            <Link href="/create" className="btn-primary inline-flex items-center justify-center gap-2 text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-2.5">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="whitespace-nowrap">Create Your First Book</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {books.map((book) => (
              <div key={book.id} className="card-magical">
                <div className="aspect-[3/4] bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg mb-3 sm:mb-4 flex items-center justify-center">
                  <BookOpen className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-purple-400" />
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1">{book.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">For {book.baby_name}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  Created {new Date(book.created_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => router.push('/create')}
                  className="btn-secondary w-full mt-3 sm:mt-4 text-sm sm:text-base py-2"
                >
                  Continue Editing
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}