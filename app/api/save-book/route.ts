import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { memoryId, illustrations } = await request.json();
    
    // Update memory status
    const { error: updateError } = await supabase
      .from('memories')
      .update({ status: 'completed' })
      .eq('id', memoryId);
    
    if (updateError) throw updateError;
    
    // Save illustrations
    for (const illustration of illustrations) {
      const { error } = await supabase
        .from('illustrations')
        .insert({
          memory_id: memoryId,
          page_number: illustration.page_number,
          image_url: illustration.url,
          prompt: illustration.prompt,
          style: illustration.style
        });
      
      if (error) throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save book error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save book' },
      { status: 500 }
    );
  }
}
