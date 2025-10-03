// lib/testing/testStoryData.ts
/**
 * Test story data for rapid development/testing
 * Yara's first beach experience
 */

import { Page } from '@/lib/store/bookStore';

export const TEST_BABY_PROFILE = {
  baby_name: 'Yara',
  birthdate: '2024-03-15',
  gender: 'girl' as const,
  baby_photo_url: undefined
};

export const TEST_STORY_DATA = {
  title: "Yara's First Beach Adventure",
  refrain: "The sand beneath her tiny toes, a world of wonder grows!",
  style: 'paper-collage',
  pages: [
    // Spread 1: Pages 1-2 (Arrival & First Touch)
    {
      page_number: 1,
      scene_type: 'opening',
      narration: "We took Yara to the beach for the very first time.",
      visual_prompt: "Baby Yara arriving at a sunny beach, seeing the golden sand and blue ocean for the first time",
      layout_template: 'text-bottom',
      characters_on_page: ['baby' as const],
      camera_angle: 'wide',
      shot_id: 'wide',
      spread_metadata: {
        seq: 0,
        beat: 'setup' as const,
        setting: 'beach',
        action: 'arriving',
        mood_palette: 'bright sunny colors',
        visual_anchor: 'shoreline band along bottom edge',
        char_anchor_hint: 'left' as const,
        text_zone_hint: 'right' as const,
        avoid: ['stickers', 'icons', 'emojis', 'gradients']
      }
    },
    {
      page_number: 2,
      scene_type: 'opening',
      narration: "Her tiny feet touched the soft, warm sand for the very first time!",
      visual_prompt: "Yara's feet touching sand, curious and happy expression",
      layout_template: 'text-bottom',
      characters_on_page: ['baby' as const],
      camera_angle: 'closeup',
      shot_id: 'closeup',
      spread_metadata: {
        seq: 0,
        beat: 'setup' as const,
        setting: 'beach',
        action: 'arriving',
        mood_palette: 'bright sunny colors',
        visual_anchor: 'shoreline band along bottom edge',
        char_anchor_hint: 'left' as const,
        text_zone_hint: 'right' as const,
        avoid: ['stickers', 'icons', 'emojis', 'gradients']
      }
    },

    // Spread 2: Pages 3-4 (Playing with feet)
    {
      page_number: 3,
      scene_type: 'action',
      narration: "Yara wiggled her toes back and forth in the sand.",
      visual_prompt: "Baby Yara playing with sand using her feet, moving them back and forth, delighted expression",
      layout_template: 'text-bottom',
      characters_on_page: ['baby' as const],
      camera_angle: 'medium',
      shot_id: 'medium',
      spread_metadata: {
        seq: 1,
        beat: 'discovery' as const,
        setting: 'beach',
        action: 'playing',
        mood_palette: 'vibrant colors',
        visual_anchor: 'sand texture with wave patterns',
        char_anchor_hint: 'right' as const,
        text_zone_hint: 'left' as const,
        avoid: ['stickers', 'icons', 'emojis', 'gradients']
      }
    },
    {
      page_number: 4,
      scene_type: 'action',
      narration: "She was so happy and curious about the texture!",
      visual_prompt: "Yara enjoying the sand, exploring its consistency with her toes",
      layout_template: 'text-bottom',
      characters_on_page: ['baby' as const],
      camera_angle: 'extreme_closeup',
      shot_id: 'extreme_closeup',
      spread_metadata: {
        seq: 1,
        beat: 'discovery' as const,
        setting: 'beach',
        action: 'playing',
        mood_palette: 'vibrant colors',
        visual_anchor: 'sand texture with wave patterns',
        char_anchor_hint: 'right' as const,
        text_zone_hint: 'left' as const,
        avoid: ['stickers', 'icons', 'emojis', 'gradients']
      }
    },

    // Spread 3: Pages 5-6 (Exploring with hands & Family joy)
    {
      page_number: 5,
      scene_type: 'action',
      narration: "Then Yara grabbed the sand with her hands, watching it fall slowly.",
      visual_prompt: "Yara holding sand in her hands, letting grains fall, fascinated by watching them",
      layout_template: 'text-bottom',
      characters_on_page: ['baby' as const],
      camera_angle: 'medium_wide',
      shot_id: 'medium_wide',
      spread_metadata: {
        seq: 2,
        beat: 'big_moment' as const,
        setting: 'beach',
        action: 'exploring',
        mood_palette: 'soft afternoon colors',
        visual_anchor: 'ground pad of textured sand',
        char_anchor_hint: 'left' as const,
        text_zone_hint: 'right' as const,
        avoid: ['stickers', 'icons', 'emojis', 'gradients']
      }
    },
    {
      page_number: 6,
      scene_type: 'closing',
      narration: "We all laughed with joy, watching her discover the simple beauty of sand.",
      visual_prompt: "Happy family moment, Yara playing with sand, parents watching with joy",
      layout_template: 'text-bottom',
      characters_on_page: ['baby' as const, 'mom' as const, 'dad' as const],
      camera_angle: 'establishing_wide',
      shot_id: 'establishing_wide',
      spread_metadata: {
        seq: 2,
        beat: 'big_moment' as const,
        setting: 'beach',
        action: 'exploring',
        mood_palette: 'soft afternoon colors',
        visual_anchor: 'ground pad of textured sand',
        char_anchor_hint: 'left' as const,
        text_zone_hint: 'right' as const,
        avoid: ['stickers', 'icons', 'emojis', 'gradients']
      }
    }
  ] as Page[],
  metadata: {
    theme: 'First beach experience',
    setting: 'Beach',
    mood: 'Wonder and joy',
    generated_at: new Date().toISOString()
  },
  cast_members: ['baby', 'mom', 'dad']
};

export const TEST_CONVERSATION = [
  {
    role: 'user',
    content: "We went with Yara for the first time to the beach and it was beautiful moment, Yara touched with her feets the sand for the first time in her life and she was so happy and cruious about it. she played with her feets back and fourth and just enjoyed the sand consistency, she also grabbed it by her hand and let it fall slowly while watching it, was so curious and happy about it. we all had a good time and lughted anjoying seeing her so facintaed by the sand."
  },
  {
    role: 'assistant',
    content: "What a precious first experience! I'll create a beautiful story about Yara's first beach adventure and her discovery of sand."
  }
];
