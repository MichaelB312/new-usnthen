import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { babyProfile, conversation } = await request.json();
    
    // Extract conversation details
    const memoryAnchor = conversation.find((c: any) => c.question === 'memory_anchor')?.answer || '';
    const whySpecial = conversation.find((c: any) => c.question === 'why_special')?.answer || '';
    const babyAction = conversation.find((c: any) => c.question === 'baby_action')?.answer || '';
    const babyReaction = conversation.find((c: any) => c.question === 'baby_reaction')?.answer || '';
    
    const prompt = `
You are a children's book author specializing in personalized baby memory books. Create a 6-page story for a ${calculateAgeInMonths(babyProfile.birthdate)}-month-old ${babyProfile.gender === 'neutral' ? 'baby' : babyProfile.gender} named ${babyProfile.baby_name}.

Memory context:
- What happened: ${memoryAnchor}
- Why it was special: ${whySpecial}
- What baby did: ${babyAction}
- Baby's reaction: ${babyReaction}

Create a JSON response with this structure:
{
  "title": "Creative title incorporating the baby's name",
  "pages": [
    {
      "page_number": 1-6,
      "scene_type": "opening_magical|action_moment|discovery|emotion_close|celebration|memory_keeper",
      "narration": "2-3 sentences of age-appropriate, poetic narration that tells this specific memory as a story",
      "visual_prompt": "Detailed prompt for AI image generation that maintains baby consistency",
      "layout_template": "hero_spread|action_focus|portrait_emphasis|collage|closing_spread"
    }
  ]
}

Requirements:
- Make it deeply personal using the actual memory details
- Keep language simple but beautiful
- Each page should flow naturally to the next
- Visual prompts should be specific and maintain character consistency
- Include emotional moments that parents will treasure
`;

    if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: "You are a talented children's book author." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 2000,
      });

      const story = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Enhance visual prompts with baby details
      story.pages = story.pages.map((page: any) => ({
        ...page,
        visual_prompt: `${page.visual_prompt}, ${babyProfile.gender === 'boy' ? 'baby boy' : babyProfile.gender === 'girl' ? 'baby girl' : 'baby'} named ${babyProfile.baby_name}, ${calculateAgeInMonths(babyProfile.birthdate)} months old, photorealistic children's book illustration`
      }));
      
      return NextResponse.json({ success: true, story });
    } else {
      // Fallback mock data for testing
      const story = generateMockStory(babyProfile, memoryAnchor, whySpecial, babyAction, babyReaction);
      return NextResponse.json({ success: true, story });
    }
    
  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate story' },
      { status: 500 }
    );
  }
}

function calculateAgeInMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

function generateMockStory(profile: any, memory: string, why: string, action: string, reaction: string) {
  return {
    title: `${profile.baby_name}'s Magical Memory`,
    pages: [
      {
        page_number: 1,
        scene_type: 'opening_magical',
        narration: `Once upon a time, little ${profile.baby_name} discovered something wonderful. ${memory}`,
        visual_prompt: `cute baby ${profile.baby_name}, ${action}, magical lighting, children's book style`,
        layout_template: 'hero_spread'
      },
      {
        page_number: 2,
        scene_type: 'action_moment',
        narration: `${why} The world seemed to sparkle with joy.`,
        visual_prompt: `baby ${profile.baby_name} ${action}, showing happiness, warm colors`,
        layout_template: 'action_focus'
      },
      {
        page_number: 3,
        scene_type: 'emotion_close',
        narration: `${profile.baby_name} ${reaction}. Every moment was filled with wonder.`,
        visual_prompt: `close-up of baby ${profile.baby_name}, ${reaction}, soft lighting`,
        layout_template: 'portrait_emphasis'
      },
      {
        page_number: 4,
        scene_type: 'discovery',
        narration: `In that special moment, ${profile.baby_name} showed us the magic in everyday life.`,
        visual_prompt: `baby ${profile.baby_name} exploring, curious expression, dreamy atmosphere`,
        layout_template: 'collage'
      },
      {
        page_number: 5,
        scene_type: 'celebration',
        narration: `With ${reaction}, ${profile.baby_name} filled our hearts with love.`,
        visual_prompt: `joyful baby ${profile.baby_name}, celebration mood, bright colors`,
        layout_template: 'action_focus'
      },
      {
        page_number: 6,
        scene_type: 'memory_keeper',
        narration: `This precious memory will forever remind us of the day when ${memory}. Our little ${profile.baby_name}, you are loved beyond measure.`,
        visual_prompt: `peaceful baby ${profile.baby_name}, golden hour, dreamy closing scene`,
        layout_template: 'closing_spread'
      }
    ]
  };
}