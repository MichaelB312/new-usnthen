'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Camera, Palette, Check, RefreshCw } from 'lucide-react';
import { useBookStore } from '@/lib/store/bookStore';
import toast from 'react-hot-toast';

export function ImageGenerator({ onComplete }: { onComplete: () => void }) {
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
  
  const styles = [
    { 
      id: 'watercolor', 
      name: 'Watercolor', 
      emoji: '🎨',
      description: 'Soft, dreamy, artistic'
    },
    { 
      id: 'crayon', 
      name: 'Crayon', 
      emoji: '🖍️',
      description: 'Playful, colorful, childlike'
    },
    { 
      id: 'pencil', 
      name: 'Colored Pencil', 
      emoji: '✏️',
      description: 'Classic, detailed, warm'
    }
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
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
    
    setGenerating(true);
    setProgress(0);
    setGeneratedImages([]);
    setGenerationComplete(false);
    
    try {
      console.log('Sending request to generate images...');
      
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyPhotoUrl: photoPreview,
          storyPages: storyData?.pages,
          style: illustrationStyle,
          bookId: bookId
        })
      });
      
      const data = await response.json();
      console.log('Received response:', data);
      
      if (data.success && data.illustrations) {
        // Update progress as images come in
        for (let i = 0; i < data.illustrations.length; i++) {
          setGeneratedImages(prev => [...prev, data.illustrations[i]]);
          setProgress(((i + 1) / data.illustrations.length) * 100);
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for visual effect
        }
        
        // Save to store
        setIllustrations(data.illustrations);
        setGenerationComplete(true);
        
        toast.success('All illustrations generated successfully!');
        
        // Don't auto-advance, let user review
      } else {
        throw new Error(data.error || 'Failed to generate illustrations');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate images. Please try again.');
      
      // For testing, use placeholder images
      const mockImages = [];
      for (let i = 0; i < (storyData?.pages.length || 6); i++) {
        mockImages.push({
          page_number: i + 1,
          url: `https://via.placeholder.com/800x800/E9D5FF/4C1D95?text=Page+${i+1}`,
          style: illustrationStyle
        });
      }
      setGeneratedImages(mockImages);
      setIllustrations(mockImages);
      setGenerationComplete(true);
    } finally {
      setGenerating(false);
    }
  };

  const regeneratePage = async (pageNumber: number) => {
    toast('Regenerating page ' + pageNumber, { icon: '🔄' });
    // Implement single page regeneration
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Step 1: Upload Baby Photo */}
      <div className="card-magical">
        <h2 className="text-3xl font-patrick gradient-text mb-6">
          Step 1: Upload Baby Photo
        </h2>
        <p className="text-gray-600 mb-6">
          This photo will be used to keep {babyProfile?.baby_name} consistent across all illustrations
        </p>
        
        {!photoPreview ? (
          <label className="block cursor-pointer">
            <div className="border-3 border-dashed border-purple-300 rounded-2xl p-12 hover:border-purple-500 transition-all hover:bg-purple-50">
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
            </div>
          </label>
        ) : (
          <div className="text-center">
            <img 
              src={photoPreview} 
              alt={babyProfile?.baby_name}
              className="w-48 h-48 rounded-full mx-auto mb-4 object-cover shadow-xl"
            />
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
      </div>

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
            {styles.map((style) => (
              <motion.button
                key={style.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIllustrationStyle(style.id as any)}
                disabled={generating}
                className={`relative p-8 rounded-2xl border-3 transition-all ${
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
                <div className="text-5xl mb-4">{style.emoji}</div>
                <h3 className="text-xl font-semibold mb-2">{style.name}</h3>
                <p className="text-sm text-gray-600">{style.description}</p>
              </motion.button>
            ))}
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
              Creating Beautiful Illustrations...
            </h3>
            
            <p className="text-gray-600 mb-6">
              Using AI to generate consistent images of {babyProfile?.baby_name}
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
          <h3 className="text-2xl font-patrick gradient-text mb-6 text-center">
            Your Illustrations Are Ready!
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {generatedImages.map((image, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <div className="aspect-square rounded-xl overflow-hidden shadow-lg">
                  <img
                    src={image.url}
                    alt={`Page ${image.page_number}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <button
                  onClick={() => regeneratePage(image.page_number)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-2 rounded-lg shadow-md hover:bg-white"
                >
                  <RefreshCw className="h-4 w-4 text-purple-600" />
                </button>
                
                <p className="text-center mt-3 font-medium">
                  Page {image.page_number}
                </p>
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