// lib/store/bookStore.ts - Fixed localStorage quota issue
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
    baby_photo_url?: string; // This is already a data URL
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
  
  // Illustrations - Store URLs separately, not persisted
  illustrations: {
    page_number: number;
    url: string; // This will now be a data URL
    style: string;
    seed?: number;
    shot?: string;
    action_id?: string;
    prompt?: string;
    model?: string;
  }[];
  illustrationStyle: 'wondrous' | 'crayon' | 'vintage' | 'watercolor' | 'pencil';
  
  // Layout - Don't persist large layouts
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
  clearStorage: () => void;
  
  // Persistence
  version: string;
  lockVersion: () => void;
}

// Custom storage that handles quota errors
const customStorage = createJSONStorage(() => {
  return {
    getItem: (name: string) => {
      try {
        const str = localStorage.getItem(name);
        return str ? JSON.parse(str) : null;
      } catch (error) {
        console.error('Failed to get from localStorage:', error);
        return null;
      }
    },
    setItem: (name: string, value: any) => {
      try {
        // Clear old data if we're about to exceed quota
        const stringified = JSON.stringify(value);
        const sizeInMB = new Blob([stringified]).size / (1024 * 1024);
        
        console.log(`Storage size: ${sizeInMB.toFixed(2)}MB`);
        
        // If it's too large, don't save images/layouts
        if (sizeInMB > 4) {
          console.warn('Data too large, removing images and layouts from storage');
          // Remove large data before saving
          const reduced = {
            ...value,
            state: {
              ...value.state,
              illustrations: [], // Don't persist illustrations
              layouts: {}, // Don't persist layouts
              babyProfile: value.state.babyProfile ? {
                ...value.state.babyProfile,
                baby_photo_url: undefined // Don't persist large photo
              } : null
            }
          };
          localStorage.setItem(name, JSON.stringify(reduced));
        } else {
          localStorage.setItem(name, stringified);
        }
      } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded, clearing old data...');
          // Try to clear and save minimal data
          try {
            const minimal = {
              ...value,
              state: {
                ...value.state,
                illustrations: [],
                layouts: {},
                babyProfile: value.state.babyProfile ? {
                  ...value.state.babyProfile,
                  baby_photo_url: undefined
                } : null
              }
            };
            localStorage.setItem(name, JSON.stringify(minimal));
          } catch (e) {
            console.error('Failed to save even minimal data:', e);
          }
        } else {
          console.error('Failed to save to localStorage:', error);
        }
      }
    },
    removeItem: (name: string) => {
      localStorage.removeItem(name);
    }
  };
});

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
      
      // Don't persist illustrations - they're too large
      setIllustrations: (illustrations) => {
        set({ illustrations });
      },
      
      setIllustrationStyle: (style) => set({ illustrationStyle: style }),
      
      // Don't persist layouts - they're too large
      setPageLayout: (pageNumber, layout) => {
        set((state) => ({
          layouts: { ...state.layouts, [pageNumber]: layout }
        }));
      },
      
      lockVersion: () => {
        const state = get();
        const version = btoa(JSON.stringify({
          profile: state.babyProfile,
          story: state.storyData,
          // Don't include illustrations or layouts in version
          timestamp: Date.now()
        }));
        set({ version });
      },
      
      clearStorage: () => {
        localStorage.removeItem('us-and-then-book');
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
      storage: customStorage,
      // Only persist essential data
      partialize: (state) => ({
        bookId: state.bookId,
        babyProfile: state.babyProfile ? {
          ...state.babyProfile,
          baby_photo_url: undefined // Don't persist large photo
        } : null,
        conversation: state.conversation,
        storyData: state.storyData,
        illustrationStyle: state.illustrationStyle,
        // Don't persist illustrations or layouts
      })
    }
  )
);