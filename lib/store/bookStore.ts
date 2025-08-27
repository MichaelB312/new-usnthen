// lib/store/bookStore.ts - Enhanced with cast management
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Character types - Added export
export type PersonId = 'baby' | 'mom' | 'dad' | 'grandma' | 'grandpa' | 'sibling' | 'aunt' | 'uncle' | 'friend';

export interface CastMember {
  id: PersonId;
  displayName: string;
  identityAnchorUrl?: string; // Stylized portrait in book style
  fallbackPhotos: string[];  // Original photos
  outfit_notes?: string;     // Lock outfits for continuity
  features_lock?: string;    // Face/hair/skin/eyes descriptors
}

export interface UploadedPhoto {
  id: string;
  fileUrl: string;      // Base64 or URL
  people: PersonId[];   // Who appears in this photo
  is_identity_anchor?: boolean;
  is_group_photo?: boolean;
  notes?: string;       // Outfit/pose notes
}

// Enhanced Page interface with character tracking
export interface Page {
  page_number: number;
  scene_type: string;
  narration: string;
  visual_prompt: string;
  illustration_url?: string;
  layout_template: string;
  resolved_layout?: any;
  
  // Character management
  characters_on_page: PersonId[];     // Who must be visible
  background_extras?: PersonId[];     // Optional background cameos
  
  // Camera and shot fields
  shot?: string;
  shot_custom?: string;
  closest_shot?: string;
  camera_angle?: string;
  camera_angle_description?: string;
  camera_prompt?: string;
  
  // Action and emotion fields
  action_id?: string;
  action_label?: string;
  emotion?: string;
  emotion_custom?: string;
  page_turn_cue?: boolean;
  
  // Enhanced visual fields
  visual_focus?: string;
  visual_action?: string;
  detail_prompt?: string;
  sensory_details?: string;
  pose_description?: string;
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
  
  // Cast management
  cast: Partial<Record<PersonId, CastMember>>; // Made partial - not all characters required
  uploadedPhotos: UploadedPhoto[];
  styleAnchorUrl?: string; // Page 1 rendered image as style anchor
  
  // Story data
  conversation: any[];
  storyData: {
    title: string;
    pages: Page[];
    metadata?: any;
    refrain?: string;
    style?: string;
    extracted_moments?: string[];
    camera_sequence?: string[];
    cast_members?: PersonId[]; // Added cast_members
  } | null;
  
  // Illustrations - UPDATED to vibrant styles
  illustrations: {
    page_number: number;
    url: string;
    style: string;
    seed?: number;
    shot?: string;
    action_id?: string;
    prompt?: string;
    model?: string;
  }[];
  illustrationStyle: 'bright-bold' | 'pop-art' | 'rainbow'; // UPDATED: New vibrant styles
  
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
  setIllustrationStyle: (style: 'bright-bold' | 'pop-art' | 'rainbow') => void; // UPDATED
  setPageLayout: (pageNumber: number, layout: any) => void;
  
  // Cast management actions
  addCastMember: (member: CastMember) => void;
  updateCastMember: (id: PersonId, updates: Partial<CastMember>) => void;
  addUploadedPhoto: (photo: UploadedPhoto) => void;
  setStyleAnchor: (url: string) => void;
  updatePageCharacters: (pageNumber: number, characters: PersonId[], extras?: PersonId[]) => void;
  
  reset: () => void;
  clearStorage: () => void;
  
  // Persistence
  version: string;
  lockVersion: () => void;
}

// Custom storage handler
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
        const stringified = JSON.stringify(value);
        const sizeInMB = new Blob([stringified]).size / (1024 * 1024);
        
        console.log(`Storage size: ${sizeInMB.toFixed(2)}MB`);
        
        if (sizeInMB > 4) {
          console.warn('Data too large, removing images and layouts from storage');
          const reduced = {
            ...value,
            state: {
              ...value.state,
              illustrations: [],
              layouts: {},
              babyProfile: value.state.babyProfile ? {
                ...value.state.babyProfile,
                baby_photo_url: undefined
              } : null,
              uploadedPhotos: value.state.uploadedPhotos?.map((p: UploadedPhoto) => ({
                ...p,
                fileUrl: undefined // Don't persist large URLs
              })) || []
            }
          };
          localStorage.setItem(name, JSON.stringify(reduced));
        } else {
          localStorage.setItem(name, stringified);
        }
      } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded, clearing old data...');
          try {
            const minimal = {
              ...value,
              state: {
                ...value.state,
                illustrations: [],
                layouts: {},
                uploadedPhotos: [],
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
      cast: {}, // Empty object is valid for Partial<Record<PersonId, CastMember>>
      uploadedPhotos: [],
      styleAnchorUrl: undefined,
      conversation: [],
      storyData: null,
      illustrations: [],
      illustrationStyle: 'bright-bold', // UPDATED: Default to vibrant style
      layouts: {},
      version: '',
      
      setBookId: (id) => set({ bookId: id }),
      setProfile: (profile) => set({ babyProfile: profile }),
      setConversation: (conversation) => set({ conversation }),
      setStory: (story) => set({ storyData: story }),
      setIllustrations: (illustrations) => set({ illustrations }),
      setIllustrationStyle: (style) => set({ illustrationStyle: style }),
      setPageLayout: (pageNumber, layout) => {
        set((state) => ({
          layouts: { ...state.layouts, [pageNumber]: layout }
        }));
      },
      
      // Cast management
      addCastMember: (member) => {
        set((state) => ({
          cast: { ...state.cast, [member.id]: member }
        }));
      },
      
      updateCastMember: (id, updates) => {
        set((state) => ({
          cast: {
            ...state.cast,
            [id]: state.cast[id] ? { ...state.cast[id], ...updates } : { id, displayName: id, fallbackPhotos: [], ...updates }
          }
        }));
      },
      
      addUploadedPhoto: (photo) => {
        set((state) => ({
          uploadedPhotos: [...state.uploadedPhotos, photo]
        }));
      },
      
      setStyleAnchor: (url) => set({ styleAnchorUrl: url }),
      
      updatePageCharacters: (pageNumber, characters, extras) => {
        set((state) => {
          if (!state.storyData) return state;
          
          const updatedPages = state.storyData.pages.map(page => 
            page.page_number === pageNumber
              ? { ...page, characters_on_page: characters, background_extras: extras }
              : page
          );
          
          return {
            storyData: {
              ...state.storyData,
              pages: updatedPages
            }
          };
        });
      },
      
      lockVersion: () => {
        const state = get();
        const version = btoa(JSON.stringify({
          profile: state.babyProfile,
          story: state.storyData,
          cast: state.cast,
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
        cast: {}, // Empty object for partial type
        uploadedPhotos: [],
        styleAnchorUrl: undefined,
        conversation: [],
        storyData: null,
        illustrations: [],
        layouts: {},
        version: '',
        illustrationStyle: 'bright-bold' // UPDATED: Reset to default vibrant style
      })
    }),
    {
      name: 'us-and-then-book',
      storage: customStorage,
      partialize: (state) => ({
        bookId: state.bookId,
        babyProfile: state.babyProfile ? {
          ...state.babyProfile,
          baby_photo_url: undefined
        } : null,
        cast: state.cast, // Save cast metadata
        conversation: state.conversation,
        storyData: state.storyData,
        illustrationStyle: state.illustrationStyle,
      })
    }
  )
);

// Utility functions for character management
export function selectImageReferences(
  page: Page,
  cast: Partial<Record<PersonId, CastMember>>, // Updated to Partial
  uploads: UploadedPhoto[],
  styleAnchorUrl: string
): string[] {
  const refs: string[] = [];
  
  // Always include style anchor first
  refs.push(styleAnchorUrl);
  
  // Add identity anchors for each character on page
  for (const pid of page.characters_on_page) {
    const anchor = cast[pid]?.identityAnchorUrl;
    if (anchor) {
      refs.push(anchor);
    } else if (cast[pid]?.fallbackPhotos?.[0]) {
      refs.push(cast[pid].fallbackPhotos[0]);
    }
  }
  
  // Look for exact-match group photo for composition
  const wantedSet = [...page.characters_on_page].sort().join('|');
  const groupPhoto = uploads.find(u => 
    u.is_group_photo && 
    [...u.people].sort().join('|') === wantedSet
  );
  if (groupPhoto) {
    refs.push(groupPhoto.fileUrl);
  }
  
  // Add background extras if specified
  for (const pid of page.background_extras ?? []) {
    const anchor = cast[pid]?.identityAnchorUrl;
    if (anchor) refs.push(anchor);
  }
  
  return refs;
}

// Extract characters from narration
export function extractCharactersFromNarration(
  narration: string,
  babyName: string
): PersonId[] {
  const characters: PersonId[] = [];
  const text = narration.toLowerCase();
  
  // Always include baby if their name is mentioned
  if (text.includes(babyName.toLowerCase())) {
    characters.push('baby');
  }
  
  // Check for family members
  const characterPatterns: Record<PersonId, RegExp[]> = {
    'mom': [/\bmom\b/, /\bmommy\b/, /\bmother\b/, /\bmama\b/],
    'dad': [/\bdad\b/, /\bdaddy\b/, /\bfather\b/, /\bpapa\b/],
    'grandma': [/\bgrandma\b/, /\bgranny\b/, /\bnana\b/],
    'grandpa': [/\bgrandpa\b/, /\bgranddad\b/, /\bpapa\b/],
    'sibling': [/\bbrother\b/, /\bsister\b/, /\bsibling\b/],
    'aunt': [/\baunt\b/, /\bauntie\b/],
    'uncle': [/\buncle\b/],
    'baby': [/\bbaby\b/, /\blittle one\b/],
    'friend': [/\bfriend\b/, /\bbuddy\b/, /\bpal\b/] // Added friend patterns
  };
  
  for (const [id, patterns] of Object.entries(characterPatterns)) {
    if (patterns.some(pattern => pattern.test(text))) {
      if (!characters.includes(id as PersonId)) {
        characters.push(id as PersonId);
      }
    }
  }
  
  // Default to baby if no characters found
  if (characters.length === 0) {
    characters.push('baby');
  }
  
  return characters;
}