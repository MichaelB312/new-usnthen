// lib/store/bookStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Complete Page interface with all new fields
interface Page {
  page_number: number;
  scene_type: string;
  narration: string;
  visual_prompt: string;
  illustration_url?: string;
  layout_template: string;
  resolved_layout?: any;
  // New fields for camera angles and actions
  shot?: string;
  shot_custom?: string;
  closest_shot?: string;
  action_id?: string;
  action_label?: string;
  emotion?: string;
  emotion_custom?: string;
  page_turn_cue?: boolean;
}

interface BookStore {
  // Basic info
  bookId: string | null;
  babyProfile: {
    baby_name: string;
    birthdate: string;
    gender: 'boy' | 'girl' | 'neutral';
    baby_photo_url?: string;
    photo_file?: File;
  } | null;
  
  // Story data
  conversation: any[];
  storyData: {
    title: string;
    pages: Page[];
    metadata?: any;
    refrain?: string;
    style?: string;
  } | null;
  
  // Illustrations
  illustrations: {
    page_number: number;
    url: string;
    style: string;
    seed?: number;
    shot?: string;
    action_id?: string;
  }[];
  illustrationStyle: 'wondrous' | 'crayon' | 'vintage' | 'watercolor' | 'pencil';
  
  // Layout
  layouts: {
    [pageNumber: number]: any;
  };
  
  // Actions
  setBookId: (id: string) => void;
  setProfile: (profile: any) => void;
  setConversation: (conversation: any[]) => void;
  setStory: (story: any) => void;
  setIllustrations: (illustrations: any[]) => void;
  setIllustrationStyle: (style: any) => void;
  setPageLayout: (pageNumber: number, layout: any) => void;
  reset: () => void;
  
  // Persistence
  version: string;
  lockVersion: () => void;
}

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      bookId: null,
      babyProfile: null,
      conversation: [],
      storyData: null,
      illustrations: [],
      illustrationStyle: 'wondrous',
      layouts: {},
      version: '',
      
      setBookId: (id) => set({ bookId: id }),
      setProfile: (profile) => set({ babyProfile: profile }),
      setConversation: (conversation) => set({ conversation }),
      setStory: (story) => set({ storyData: story }),
      setIllustrations: (illustrations) => set({ illustrations }),
      setIllustrationStyle: (style) => set({ illustrationStyle: style }),
      setPageLayout: (pageNumber, layout) => set((state) => ({
        layouts: { ...state.layouts, [pageNumber]: layout }
      })),
      
      lockVersion: () => {
        const state = get();
        const version = btoa(JSON.stringify({
          profile: state.babyProfile,
          story: state.storyData,
          illustrations: state.illustrations,
          layouts: state.layouts,
          timestamp: Date.now()
        }));
        set({ version });
      },
      
      reset: () => set({
        bookId: null,
        babyProfile: null,
        conversation: [],
        storyData: null,
        illustrations: [],
        layouts: {},
        version: ''
      })
    }),
    {
      name: 'us-and-then-book',
    }
  )
);