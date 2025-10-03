// lib/utils/buildSpreads.ts
import { Page, Spread } from '@/lib/store/bookStore';

/**
 * SIMPLIFIED: Builds display spreads from pages.
 * Each page is a 1536×1024 landscape image that displays as an "open book" with divider.
 *
 * NEW APPROACH:
 * - 4 pages, each with ONE narration and ONE illustration
 * - NO pairing or merging needed
 * - Customer sees "8 pages" due to visual divider effect
 *
 * @param pages - Array of story pages (always 4 pages now)
 * @param illustrations - Array of generated illustrations
 * @returns Array of Spread objects for rendering
 */
export function buildSpreads(
  pages: Page[],
  illustrations: Array<{ page_number: number; url: string }>
): Spread[] {
  const spreads: Spread[] = [];

  // Simple: Each page = one landscape image = one spread display
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page) continue;

    // Find the illustration for this page (page_number matches directly)
    const illustration = illustrations.find(
      (ill) => ill.page_number === page.page_number
    );

    // Each page has its own narration (no merging!)
    spreads.push({
      imageUrl: illustration?.url || '',
      text: page.narration || '',
      pageRangeLabel: `Page ${page.page_number}`,
      spreadIndex: i
    });
  }

  return spreads;
}
