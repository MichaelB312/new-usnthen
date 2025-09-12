# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Us & Then" - an AI-powered web application for transforming precious baby memories into beautifully illustrated storybooks. The app generates personalized children's books using AI story generation and illustration techniques, specifically employing a "paper-collage" art style.

## Technology Stack

- **Frontend**: Next.js 14.2.3 with React 18, TypeScript
- **Styling**: Tailwind CSS with custom fonts (Inter, Patrick Hand, Caveat)
- **State Management**: Zustand with localStorage persistence
- **Backend**: Next.js API routes with Supabase integration
- **Database**: Supabase (PostgreSQL)
- **AI Services**: OpenAI API, Replicate API
- **Payment**: Stripe integration
- **Image Processing**: Sharp (optional dependency)
- **Additional**: Framer Motion, Lucide React icons, React Hot Toast
- **Note**: PDF generation has been removed - the app only sells hardcover books

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run install-full` - Install all dependencies including optional ones (sharp, konva, react-konva)
- `npm run clean` - Clean node_modules and .next, then reinstall

## Code Architecture

### Core Directory Structure

- **`app/`** - Next.js app router pages and API routes
  - `page.tsx` - Landing page
  - `create/page.tsx` - Main book creation wizard
  - `dashboard/page.tsx` - User dashboard
  - `api/` - Server-side API routes for AI generation, payments
- **`components/`** - Reusable React components organized by feature
  - `baby-profile/` - Profile creation forms
  - `story-wizard/` - Chat interface for story creation
  - `book-preview/` - Book rendering and preview
  - `cast-management/` - Character/person management
  - `providers/` - React context providers
- **`lib/`** - Shared utilities and core logic
  - `store/bookStore.ts` - Central Zustand store
  - `supabase/` - Database client and helpers
  - `layout/` - Text layout and positioning engines
  - `decorations/` - AI decoration generation

### State Management (Zustand Store)

The application uses a centralized Zustand store (`lib/store/bookStore.ts`) that manages:

- **Book metadata**: ID, baby profile, cast members
- **Story data**: Conversation, generated story with pages, titles, metadata
- **Illustrations**: AI-generated images in paper-collage style only
- **Character management**: Cast members with photo references and identity anchors
- **Persistence**: Smart localStorage with size management to handle large image data

Key types:
- `PersonId`: Character identifiers ('baby', 'mom', 'dad', etc.)
- `CastMember`: Character with photos and descriptions
- `Page`: Story page with narration, visual prompts, illustration URLs, and character assignments
- `UploadedPhoto`: User photos with character associations

### AI Integration

The app integrates multiple AI services:

1. **Story Generation** (`api/generate-story/`) - OpenAI GPT for creating story narratives
2. **Image Generation** (`api/generate-image-async/`) - Replicate API for paper-collage style illustrations

### Character System

Advanced character management allows users to:
- Upload photos of family members
- Set identity anchor photos for consistent AI generation
- Assign characters to specific story pages
- Use fallback photos when identity anchors aren't available

### Layout Engine

Sophisticated text layout system (`lib/layout/EnhancedLayoutEngine.ts`) handles:
- Dynamic text positioning
- Font sizing and fitting
- Page template management
- Text wrapping and overflow handling

## Development Guidelines

### Environment Setup

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- OpenAI and Replicate API keys (server-side)
- Stripe keys for payments

### Code Patterns

- Use TypeScript strict mode - all files should be properly typed
- Components use 'use client' directive when needed for client-side features
- State management through Zustand store, avoid prop drilling
- File uploads handled via Supabase storage
- API routes follow REST conventions with proper error handling
- Use Framer Motion for animations and transitions
- Toast notifications via react-hot-toast

### Styling Conventions

- Tailwind utility classes for all styling
- Custom fonts defined in `app/layout.tsx` using CSS variables
- Responsive design with mobile-first approach
- Consistent color scheme using Tailwind's purple/pink/blue palette
- Glass morphism and gradient effects for modern UI feel

### Testing & Building

- Run `npm run lint` before committing
- Ensure `npm run build` completes successfully
- Test with both required and optional dependencies installed
- Verify Supabase integration in development environment

## Important Notes

- The app specifically uses "paper-collage" as the only illustration style
- Image generation is asynchronous and may take several seconds
- Local storage persistence handles large data gracefully with size limits
- Character photos are crucial for AI illustration quality
- The app focuses on hardcover book production rather than digital exports
- Server actions are configured for multiple localhost ports and GitHub Codespaces