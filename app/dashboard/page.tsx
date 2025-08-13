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
    <div className="min-h-screen p-6 pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="btn-ghost flex items-center gap-2"
          >
            <Home className="h-5 w-5" />
            Home
          </button>
          
          <h1 className="text-4xl font-patrick gradient-text">My Storybooks</h1>
          
          <Link href="/create" className="btn-primary flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Book
          </Link>
        </div>

        {books.length === 0 ? (
          <div className="card-magical text-center py-20">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-4">No books yet</h2>
            <p className="text-gray-600 mb-6">Create your first magical storybook!</p>
            <Link href="/create" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Your First Book
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {books.map((book) => (
              <div key={book.id} className="card-magical">
                <div className="aspect-[3/4] bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg mb-4 flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-purple-400" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{book.title}</h3>
                <p className="text-sm text-gray-600 mb-2">For {book.baby_name}</p>
                <p className="text-xs text-gray-500">
                  Created {new Date(book.created_at).toLocaleDateString()}
                </p>
                <button 
                  onClick={() => router.push('/create')}
                  className="btn-secondary w-full mt-4"
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