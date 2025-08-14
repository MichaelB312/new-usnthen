// components/illustrations/EnhancedImageGenerator.tsx
'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Camera, Palette, Check, RefreshCw, Sparkles, Brush, Book } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

export function EnhancedImageGenerator({ onComplete }: { onComplete: () => void }) {
  const { 
    babyProfile, 
    storyData, 
    bookId,
    setIllustrations,
    illustrationStyle,
    setIllustrationStyle 
  } = useBookStore();
  
  const [photoPreview, setPhotoPreview] = useState<string>(babyProfile?.baby_photo_url || '');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [generationComplete, setGenerationComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Enhanced style options
  const styles = [
    { 
      id: 'wondrous', 
      name: 'Wondrous', 
      icon: Sparkles,
      description: 'Magical, airy watercolor',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      id: 'crayon', 
      name: 'Crayon', 
      icon: Brush,
      description: 'Waxy, hand-drawn style',
      gradient: 'from-orange-400 to-red-400'
    },
    { 
      id: 'vintage', 
      name: 'Vintage', 
      icon: Book,
      description: 'Mid-century print aesthetic',
      gradient: 'from-amber-400 to-brown-400'
    }
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo must be less than 10MB');
      return;
    }
    
    setUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPhotoPreview(base64);
        
        // Update store with photo URL
        useBookStore.setState((state) => ({
          babyProfile: {
            ...state.babyProfile!,
            baby_photo_url: base64
          }
        }));
        
        toast.success('Photo uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const generateImages = async () => {
    if (!photoPreview) {
      toast.error('Please upload a baby photo first');
      return;
    }
    
    if (!storyData?.pages) {
      toast.error('Story data is missing');
      return;
    }
    
    setGenerating(true);
    setProgress(0);
    setGeneratedImages([]);
    setGenerationComplete(false);
    
    try {
      console.log('Generating images with OpenAI...');
      
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyPhotoUrl: photoPreview,
          storyPages: storyData.pages,
          style: illustrationStyle,
          bookId: bookId
        })
      });
      
      const data = await response.json();
      console.log('Generation response:', data);
      
      if (data.success && data.illustrations) {
        // Animate progress as images come in
        const totalImages = data.illustrations.length;
        
        for (let i = 0; i < totalImages; i++) {
          setGeneratedImages(prev => [...prev, data.illustrations[i]]);
          setProgress(((i + 1) / totalImages) * 100);
          
          // Small delay for visual effect
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Save to store
        setIllustrations(data.illustrations);
        setGenerationComplete(true);
        
        toast.success(`All illustrations generated using ${data.method === 'openai' ? 'OpenAI' : 'Replicate'}!`);
      } else {
        throw new Error(data.error || 'Failed to generate illustrations');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate images. Please try again.');
      
      // Create placeholder images for testing
      const mockImages = storyData.pages.map((page: any, i: number) => ({
        page_number: page.page_number,
        url: `https://via.placeholder.com/3600x2400/E9D5FF/4C1D95?text=Page+${page.page_number}+${page.shot}`,
        style: illustrationStyle,
        shot: page.shot,
        action_id: page.action_id
      }));
      
      setGeneratedImages(mockImages);
      setIllustrations(mockImages);
      setGenerationComplete(true);
    } finally {
      setGenerating(false);
    }
  };

  const regeneratePage = async (pageNumber: number) => {
    const page = storyData?.pages.find((p: any) => p.page_number === pageNumber);
    if (!page) return;
    
    toast('Regenerating page ' + pageNumber, { icon: '🔄' });
    
    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyPhotoUrl: photoPreview,
          storyPages: [page],
          style: illustrationStyle,
          bookId: bookId
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.illustrations?.[0]) {
        const newImage = data.illustrations[0];
        
        // Update the specific image
        setGeneratedImages(prev => prev.map(img => 
          img.page_number === pageNumber ? newImage : img
        ));
        
        // Update store
        const updatedIllustrations = generatedImages.map(img => 
          img.page_number === pageNumber ? newImage : img
        );
        setIllustrations(updatedIllustrations);
        
        toast.success('Page regenerated successfully!');
      }
    } catch (error) {
      toast.error('Failed to regenerate page');
    }
  };

  const changeStyle = async (newStyle: 'wondrous' | 'crayon' | 'vintage') => {
    if (newStyle === illustrationStyle) return;
    
    const confirmed = window.confirm(
      'Changing style will regenerate all images. Continue?'
    );
    
    if (confirmed) {
      setIllustrationStyle(newStyle);
      await generateImages();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Step 1: Upload Baby Photo */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-magical"
      >
        <h2 className="text-3xl font-patrick gradient-text mb-6">
          Step 1: Baby's Reference Photo
        </h2>
        <p className="text-gray-600 mb-6">
          Upload a clear photo of {babyProfile?.baby_name}. Our AI will maintain consistent character appearance across all illustrations.
        </p>
        
        {!photoPreview ? (
          <label className="block cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="border-3 border-dashed border-purple-300 rounded-2xl p-12 hover:border-purple-500 transition-all hover:bg-purple-50"
            >
              <Camera className="h-20 w-20 text-purple-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-center mb-2">
                Click to Upload Photo
              </p>
              <p className="text-sm text-gray-500 text-center">
                JPG, PNG up to 10MB • Best with clear face visible
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploading}
              />
            </motion.div>
          </label>
        ) : (
          <div className="text-center">
            <div className="relative inline-block">
              <img 
                src={photoPreview} 
                alt={babyProfile?.baby_name}
                className="w-48 h-48 rounded-2xl mx-auto mb-4 object-cover shadow-xl"
              />
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-2">
                <Check className="h-5 w-5" />
              </div>
            </div>
            <button 
              onClick={() => {
                setPhotoPreview('');
                setGeneratedImages([]);
                setGenerationComplete(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="btn-secondary"
              disabled={generating}
            >
              Change Photo
            </button>
          </div>
        )}
      </motion.div>

      {/* Step 2: Choose Art Style */}
      {photoPreview && !generationComplete && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-magical"
        >
          <h2 className="text-3xl font-patrick gradient-text mb-6">
            Step 2: Choose Art Style
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {styles.map((style) => {
              const Icon = style.icon;
              return (
                <motion.button
                  key={style.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIllustrationStyle(style.id as any)}
                  disabled={generating}
                  className={`relative p-8 rounded-2xl border-3 transition-all overflow-hidden ${
                    illustrationStyle === style.id
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  {illustrationStyle === style.id && (
                    <div className="absolute top-3 right-3">
                      <Check className="h-6 w-6 text-purple-600" />
                    </div>
                  )}
                  
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${style.gradient} mb-4`}>
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-2">{style.name}</h3>
                  <p className="text-sm text-gray-600">{style.description}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Step 3: Generate Button */}
      {photoPreview && !generating && !generationComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <button
            onClick={generateImages}
            className="btn-primary w-full text-xl py-6 flex items-center justify-center gap-3"
          >
            <Wand2 className="h-7 w-7" />
            Generate All Illustrations with AI
          </button>
        </motion.div>
      )}

      {/* Generation Progress */}
      {generating && (
        <div className="card-magical">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="inline-block mb-6"
            >
              <Wand2 className="h-16 w-16 text-purple-600" />
            </motion.div>
            
            <h3 className="text-2xl font-patrick gradient-text mb-4">
              Creating Magical Illustrations...
            </h3>
            
            <p className="text-gray-600 mb-6">
              Using AI to generate consistent images of {babyProfile?.baby_name} in {illustrationStyle} style
            </p>
            
            <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden mb-3">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-pink-600"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            <p className="text-sm text-gray-600">
              {Math.round(progress)}% Complete • Page {Math.ceil(progress / 100 * (storyData?.pages.length || 6))} of {storyData?.pages.length || 6}
            </p>
          </div>
        </div>
      )}

      {/* Generated Images Grid */}
      {generationComplete && generatedImages.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-magical"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-patrick gradient-text">
              Your Illustrations Are Ready!
            </h3>
            
            {/* Style Switcher */}
            <div className="flex gap-2">
              {styles.map((style) => {
                const Icon = style.icon;
                return (
                  <button
                    key={style.id}
                    onClick={() => changeStyle(style.id as any)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                      illustrationStyle === style.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {style.name}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {generatedImages.map((image, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <div className="aspect-[3/2] rounded-xl overflow-hidden shadow-lg bg-gray-100">
                  <img
                    src={image.url}
                    alt={`Page ${image.page_number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                
                <button
                  onClick={() => regeneratePage(image.page_number)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-2 rounded-lg shadow-md hover:bg-white"
                  title="Regenerate this page"
                >
                  <RefreshCw className="h-4 w-4 text-purple-600" />
                </button>
                
                <div className="mt-3 space-y-1">
                  <p className="font-medium">Page {image.page_number}</p>
                  {image.shot && (
                    <p className="text-xs text-gray-500">Shot: {image.shot}</p>
                  )}
                  {image.action_id && (
                    <p className="text-xs text-gray-500">Action: {image.action_id.replace(/_/g, ' ')}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => {
                setGeneratedImages([]);
                setGenerationComplete(false);
              }}
              className="btn-secondary flex-1"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Regenerate All
            </button>
            
            <button
              onClick={onComplete}
              className="btn-primary flex-1"
            >
              Continue to Book Preview
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}