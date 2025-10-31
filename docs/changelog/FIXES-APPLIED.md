# Fixes Applied - Image Generation Issues

## Date: Current Session

## Issues Addressed

### 1. ✅ Text Disappearing (Pages 1 & 2)
**Root Cause:** Inpainting mask was using estimated text bounds instead of actual rendered bounds, causing text to be partially editable and overwritten by Layer 3.

**Fix Applied:**
- Modified `localComposition.ts` to return actual text bounds from rendering
- Changed `composeSpread()` return type to include `actualTextBounds`
- Updated `renderNarrationText()` to calculate and return exact bounds of rendered text
- Modified `generate-image-async/route.ts` to use actual bounds instead of estimation

**Files Modified:**
- `/lib/utils/localComposition.ts:32-100, 103-184`
- `/app/api/generate-image-async/route.ts:17-32, 835-856`

---

### 2. ✅ Full Background Coverage (Page 4)
**Root Cause:** Inpainting mask was too permissive (100px margins) giving GPT-Image-1 too much space to fill

**Fix Applied:**
- **Reduced character protection margin** from 100px to 60px (more conservative)
- **Increased text protection margin** from 50px to 80px (stronger protection)
- Added explicit comments about conservative approach

**Files Modified:**
- `/lib/utils/inpaintingMasks.ts:49-80`

**Changes:**
\`\`\`typescript
// BEFORE:
const textMargin = 50;
const charProtectMargin = 100;

// AFTER:
const textMargin = 80; // Increased for stronger protection
const charProtectMargin = 60; // Reduced for more conservative mask
\`\`\`

---

### 3. ✅ Overly Aggressive Layer 3 Prompts
**Root Cause:** GPT-Image-1 was ignoring "MINIMAL" instructions and creating full backgrounds

**Fix Applied:**
- Added **ABSOLUTE PROHIBITIONS** section with explicit ❌ items
- Added **MUST DO** section with explicit ✓ requirements
- Increased white space preservation from 50% to 60%
- Added specific instructions about what NOT to do

**Files Modified:**
- `/app/api/generate-image-async/route.ts:312-338`

**New Prompt Structure:**
\`\`\`
CRITICAL PLACEMENT RULES:
- PRESERVE WHITE BACKGROUND: At least 60% MUST remain white/clean
- Elements are SMALL ACCENTS ONLY

ABSOLUTE PROHIBITIONS (DO NOT DO THESE):
❌ DO NOT create full-page backgrounds
❌ DO NOT fill entire corners or sides
❌ DO NOT cover white space with texture
❌ DO NOT modify existing narration text
... (8 explicit prohibitions)

MUST DO (REQUIREMENTS):
✓ Keep composition LIGHT and AIRY
✓ Elements must be SMALL SCALE decorative accents
✓ Preserve large areas of clean white background
... (6 explicit requirements)
\`\`\`

---

### 4. ⚠️ Frontend Polling (Page 3 Stuck)
**Status:** NOT APPLIED (Edit tool formatting issues)

**Root Cause:** Frontend polling continues silently when API requests fail

**Issue:** Unable to modify AsyncBatchedImageGenerator.tsx due to file encoding/formatting

**Impact:** Backend completes successfully (verified by logs), so this is only a UI state issue. The actual image generation works fine.

---

## Testing Checklist

- [ ] Generate pages 1-4 with narration text
- [ ] Verify text appears correctly on all pages
- [ ] Verify backgrounds are minimal (60px margins only)
- [ ] Verify 60%+ white space preserved
- [ ] Verify no full-page background fills
- [ ] Check terminal logs for "Actual text bounds" messages
- [ ] Verify Layer 3 prompts include prohibitions

---

## Summary

**3 out of 4 fixes successfully applied:**
1. ✅ Text bounds now use actual rendered dimensions (not estimated)
2. ✅ Inpainting mask is more conservative (60px margins instead of 100px)
3. ✅ Layer 3 prompts have explicit prohibitions and requirements
4. ⚠️ Frontend polling improvements documented but not applied

**Impact:**
- Text should no longer disappear from pages 1 & 2
- Page 4 should no longer generate full backgrounds
- All pages should have cleaner, more minimal compositions with preserved white space

**Next Steps:**
1. Test the fixes with a full generation run
2. Monitor terminal logs for "Actual text bounds" messages
3. Verify text protection in final images
