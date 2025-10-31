# Illustration Preview System - Quick Reference

## 🎯 What It Does
Customers preview story illustrations BEFORE final generation and can request changes through natural conversation.

---

## 🔄 Flow

```
Memory Questions
       ↓
✨ "Creating preview..."
       ↓
📖 "Here's page 1 of 8..."
       ↓
💬 User: "next" or "add X"
       ↓
📖 "Here's page 2 of 8..."
       ↓
[Repeat for 8 pages]
       ↓
✨ "Creating full story..."
       ↓
📚 Review Screen
```

---

## 📁 Key Files

### New
- `/app/api/generate-story-preview/route.ts` - Preview generation

### Modified
- `HybridChatInterface.tsx` - Conversational preview
- `bookStore.ts` - Added `illustration_description`
- `StoryMemoryDirector.ts` - Added preview phase
- `generate-story/route.ts` - Incorporates feedback

---

## 💻 Code Snippets

### Trigger Preview
```typescript
// After conversation completes
generateStoryPreview(collectedData);
```

### Show Page
```typescript
showPreviewPage(pageIndex, pages);
// Displays as chat message
```

### Handle Response
```typescript
handlePreviewResponse(userInput);
// "next" → show next page
// "add X" → save feedback, show next page
```

### Compile Feedback
```typescript
const allFeedback = previewFeedback
  .map((f, i) => f ? `Page ${i+1}: ${f}` : null)
  .filter(Boolean)
  .join('\n');
```

---

## 🎨 Message Format

```
📖 Page X of 8

📝 Story:
"[Brief narration]"

🎨 Illustration will show:
[Customer-friendly description]

Characters: baby, mama, aba

---
Type "next" to continue, or tell me what you'd like to change!
```

---

## 🐛 Common Issues

### Preview Not Showing
**Check:** `previewMode` state, API response, console logs

### Infinite Loop
**Fix:** `illustration_feedback` must be `required: false`

### Feedback Not Applied
**Check:** Feedback compilation, conversation data, API payload

---

## ⚙️ Configuration

```typescript
// Models
Preview: 'gemini-2.5-flash'  // Fast
Story:   'gemini-2.0-pro'     // Quality

// Approval Keywords
['next', 'looks good', 'continue', 'ok', 'good']

// Pages
Always 8 pages (matches full story)
```

---

## 🧪 Testing Commands

```bash
# Build
npm run build

# Check TypeScript
npx tsc --noEmit

# Test flow
# 1. Start dev server
# 2. Create new book
# 3. Complete questions
# 4. Say "ready"
# 5. Preview should appear
# 6. Type "next" or feedback
# 7. Continue through 8 pages
# 8. Full story generates
```

---

## 📊 Performance

- Preview: 3-5 seconds
- User review: 30-60 seconds
- Full story: 15-20 seconds
- **Total added:** ~45-65 seconds

---

## 🔑 State Variables

```typescript
previewMode: 'inactive' | 'reviewing'
currentPreviewPageIndex: number
previewFeedback: string[]
editedPreviewPages: any[]
isGeneratingPreview: boolean
```

---

## 🎯 User Actions

**Approve Page:**
- "next"
- "looks good"
- "ok"
- "continue"

**Provide Feedback:**
- "add a blue bucket"
- "include our dog"
- "change X to Y"

---

## 📞 API Endpoints

### Preview Generation
```
POST /api/generate-story-preview
Time: ~3-5 seconds
Model: gemini-2.5-flash
```

### Full Story
```
POST /api/generate-story
Time: ~15-20 seconds
Model: gemini-2.0-pro
Includes: Customer feedback
```

---

## 🚨 Critical Points

1. `illustration_feedback` must be `required: false`
2. Preview mode intercepts `handleSend()`
3. Feedback stored as array indexed by page
4. "next" triggers page advance, not feedback
5. Pure chat - no UI components in message flow

---

## 📖 Full Documentation

See: `ILLUSTRATION_PREVIEW_SYSTEM.md`

---

**Last Updated:** 2025-10-22
