// components/character-description/CharacterDescriptionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Check, X, ChevronDown, 
  User, Baby, Eye, Palette, Scissors, Shirt
} from 'lucide-react';
import { PersonId } from '@/lib/store/bookStore';

interface CharacterDescriptionModalProps {
  characterId: PersonId;
  characterName: string;
  onSave: (description: string, metadata?: any) => void;
  onCancel: () => void;
  gender?: 'boy' | 'girl' | 'neutral';
  existingDescription?: string;
}

// Structured attribute options
const ATTRIBUTE_OPTIONS = {
  age: {
    baby: ['newborn', '3 months old', '6 months old', '9 months old', '12 months old', '18 months old', 'toddler'],
    child: ['2 years old', '3 years old', '4 years old', '5 years old'],
    adult: ['young adult', 'in their 30s', 'in their 40s', 'in their 50s', 'in their 60s', 'elderly']
  },
  skinTone: ['fair', 'light', 'medium', 'olive', 'tan', 'brown', 'dark'],
  eyeColor: ['blue', 'green', 'hazel', 'light brown', 'dark brown', 'gray', 'amber'],
  hairColor: ['blonde', 'light brown', 'dark brown', 'black', 'red', 'auburn', 'gray', 'white'],
  hairStyle: {
    baby: ['wispy', 'bald', 'short and fluffy', 'small curls', 'straight'],
    child: ['short', 'shoulder-length', 'long', 'curly', 'straight', 'wavy', 'braided', 'ponytail'],
    adult: ['short', 'shoulder-length', 'long', 'curly', 'straight', 'wavy', 'bob', 'pixie cut', 'bald']
  },
  build: {
    baby: ['chubby', 'average', 'petite'],
    child: ['small', 'average', 'tall for age', 'sturdy'],
    adult: ['petite', 'average', 'athletic', 'tall', 'plus-size']
  },
  specialFeatures: [
    'dimples', 
    'freckles', 
    'birthmark', 
    'glasses', 
    'big smile', 
    'rosy cheeks',
    'long eyelashes',
    'button nose',
    'round face',
    'oval face',
    'chubby arms',
    'tiny hands',
    'bright eyes',
    'toothless grin',
    'one tooth showing',
    'gap between teeth',
    'mole',
    'none'
  ]
};

interface CharacterAttributes {
  age: string;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  build: string;
  specialFeatures: string[];
  clothing: string;
  customNotes: string;
}

// Parse existing description back to attributes
function parseDescription(description: string): Partial<CharacterAttributes> {
  const attributes: Partial<CharacterAttributes> = {};
  
  // Try to extract attributes from description
  const lowerDesc = description.toLowerCase();
  
  // Extract age
  for (const ageOpt of [...ATTRIBUTE_OPTIONS.age.baby, ...ATTRIBUTE_OPTIONS.age.child, ...ATTRIBUTE_OPTIONS.age.adult]) {
    if (lowerDesc.includes(ageOpt)) {
      attributes.age = ageOpt;
      break;
    }
  }
  
  // Extract skin tone
  for (const skin of ATTRIBUTE_OPTIONS.skinTone) {
    if (lowerDesc.includes(skin)) {
      attributes.skinTone = skin;
      break;
    }
  }
  
  // Extract eye color
  for (const eyes of ATTRIBUTE_OPTIONS.eyeColor) {
    if (lowerDesc.includes(eyes)) {
      attributes.eyeColor = eyes;
      break;
    }
  }
  
  // Extract hair color
  for (const hair of ATTRIBUTE_OPTIONS.hairColor) {
    if (lowerDesc.includes(hair)) {
      attributes.hairColor = hair;
      break;
    }
  }
  
  return attributes;
}

// Custom dropdown component
function AttributeDropdown({ 
  label, 
  value, 
  options, 
  onChange, 
  icon: Icon 
}: { 
  label: string; 
  value: string; 
  options: string[]; 
  onChange: (val: string) => void;
  icon?: any;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left bg-white border-2 border-purple-200 rounded-lg focus:outline-none focus:border-purple-500 flex items-center justify-between hover:border-purple-400 transition-colors"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || `Select ${label}`}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white border-2 border-purple-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {options.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors ${
                  value === option ? 'bg-purple-100 text-purple-700 font-medium' : ''
                }`}
              >
                {option}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CharacterDescriptionModal({ 
  characterId, 
  characterName, 
  onSave, 
  onCancel,
  gender = 'neutral',
  existingDescription = ''
}: CharacterDescriptionModalProps) {
  // Determine character type
  const isChild = characterId === 'baby' || characterId === 'sibling';
  const isBaby = characterId === 'baby';
  const characterType = isBaby ? 'baby' : isChild ? 'child' : 'adult';
  
  // Initialize attributes
  const [attributes, setAttributes] = useState<CharacterAttributes>(() => {
    if (existingDescription) {
      const parsed = parseDescription(existingDescription);
      return {
        age: parsed.age || '',
        skinTone: parsed.skinTone || '',
        eyeColor: parsed.eyeColor || '',
        hairColor: parsed.hairColor || '',
        hairStyle: parsed.hairStyle || '',
        build: parsed.build || '',
        specialFeatures: parsed.specialFeatures || [],
        clothing: '',
        customNotes: ''
      };
    }
    
    return {
      age: '',
      skinTone: '',
      eyeColor: '',
      hairColor: '',
      hairStyle: '',
      build: '',
      specialFeatures: [],
      clothing: '',
      customNotes: ''
    };
  });
  
  const [currentStep, setCurrentStep] = useState(0);
  
  // Build description from attributes
  const buildDescription = (): string => {
    const parts: string[] = [];
    
    // Age and build
    if (attributes.age && attributes.build) {
      parts.push(`A ${attributes.build} ${attributes.age} ${characterType}`);
    } else if (attributes.age) {
      parts.push(`A ${attributes.age} ${characterType}`);
    }
    
    // Skin
    if (attributes.skinTone) {
      parts.push(`with ${attributes.skinTone} skin`);
    }
    
    // Eyes
    if (attributes.eyeColor) {
      parts.push(`${attributes.eyeColor} eyes`);
    }
    
    // Hair
    if (attributes.hairColor && attributes.hairStyle) {
      parts.push(`${attributes.hairStyle} ${attributes.hairColor} hair`);
    } else if (attributes.hairColor) {
      parts.push(`${attributes.hairColor} hair`);
    }
    
    // Special features
    if (attributes.specialFeatures.length > 0 && !attributes.specialFeatures.includes('none')) {
      parts.push(`with ${attributes.specialFeatures.join(' and ')}`);
    }
    
    // Clothing
    if (attributes.clothing) {
      parts.push(`wearing ${attributes.clothing}`);
    } else if (isBaby) {
      // Default clothing if not specified
      if (gender === 'girl') {
        parts.push('wearing a pink outfit');
      } else if (gender === 'boy') {
        parts.push('wearing a blue outfit');
      } else {
        parts.push('wearing a colorful outfit');
      }
    }
    
    // Custom notes
    if (attributes.customNotes) {
      parts.push(`. ${attributes.customNotes}`);
    }
    
    return parts.join(', ').replace(', .', '.') + (attributes.customNotes ? '' : '.');
  };
  
  // Validate if minimum attributes are selected
  const isValid = (): boolean => {
    return !!(attributes.age && attributes.skinTone && attributes.eyeColor && attributes.hairColor);
  };
  
  // Save description
  const handleSave = () => {
    const description = buildDescription();
    onSave(description, {
      characterId,
      characterName,
      isTextDescription: true,
      attributes
    });
  };
  
  // Step navigation
  const steps = [
    { title: 'Basic Info', fields: ['age', 'build'] },
    { title: 'Appearance', fields: ['skinTone', 'eyeColor'] },
    { title: 'Hair', fields: ['hairColor', 'hairStyle'] },
    { title: 'Features', fields: ['specialFeatures'] },
    { title: 'Clothing & Details', fields: ['clothing', 'customNotes'] }
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Palette className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-patrick">Describe {characterName}</h2>
                <p className="text-purple-100">Fill in the details step by step</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex justify-between">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 ${
                  idx === currentStep ? 'text-purple-600 font-medium' : 
                  idx < currentStep ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === currentStep ? 'bg-purple-600 text-white' :
                  idx < currentStep ? 'bg-green-500 text-white' : 'bg-gray-200'
                }`}>
                  {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {currentStep === 0 && (
                <>
                  <AttributeDropdown
                    label="Age"
                    value={attributes.age}
                    options={ATTRIBUTE_OPTIONS.age[characterType as keyof typeof ATTRIBUTE_OPTIONS.age] as string[]}
                    onChange={(val) => setAttributes(prev => ({ ...prev, age: val }))}
                  />
                  <AttributeDropdown
                    label="Build"
                    value={attributes.build}
                    options={ATTRIBUTE_OPTIONS.build[characterType as keyof typeof ATTRIBUTE_OPTIONS.build] as string[]}
                    onChange={(val) => setAttributes(prev => ({ ...prev, build: val }))}
                  />
                </>
              )}
              
              {currentStep === 1 && (
                <>
                  <AttributeDropdown
                    label="Skin Tone"
                    value={attributes.skinTone}
                    options={ATTRIBUTE_OPTIONS.skinTone}
                    onChange={(val) => setAttributes(prev => ({ ...prev, skinTone: val }))}
                    icon={Palette}
                  />
                  <AttributeDropdown
                    label="Eye Color"
                    value={attributes.eyeColor}
                    options={ATTRIBUTE_OPTIONS.eyeColor}
                    onChange={(val) => setAttributes(prev => ({ ...prev, eyeColor: val }))}
                    icon={Eye}
                  />
                </>
              )}
              
              {currentStep === 2 && (
                <>
                  <AttributeDropdown
                    label="Hair Color"
                    value={attributes.hairColor}
                    options={ATTRIBUTE_OPTIONS.hairColor}
                    onChange={(val) => setAttributes(prev => ({ ...prev, hairColor: val }))}
                  />
                  <AttributeDropdown
                    label="Hair Style"
                    value={attributes.hairStyle}
                    options={ATTRIBUTE_OPTIONS.hairStyle[characterType as keyof typeof ATTRIBUTE_OPTIONS.hairStyle] as string[]}
                    onChange={(val) => setAttributes(prev => ({ ...prev, hairStyle: val }))}
                    icon={Scissors}
                  />
                </>
              )}
              
              {currentStep === 3 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Special Features (select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                    {ATTRIBUTE_OPTIONS.specialFeatures.map(feature => (
                      <button
                        key={feature}
                        type="button"
                        onClick={() => {
                          setAttributes(prev => {
                            const features = feature === 'none' 
                              ? [] 
                              : prev.specialFeatures.includes(feature)
                                ? prev.specialFeatures.filter(f => f !== feature)
                                : [...prev.specialFeatures.filter(f => f !== 'none'), feature];
                            return { ...prev, specialFeatures: features };
                          });
                        }}
                        className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                          attributes.specialFeatures.includes(feature)
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Shirt className="h-4 w-4" />
                      What was {characterName} wearing?
                    </label>
                    <input
                      type="text"
                      value={attributes.clothing}
                      onChange={(e) => setAttributes(prev => ({ ...prev, clothing: e.target.value }))}
                      placeholder={
                        isBaby 
                          ? "e.g., yellow onesie with ducks, striped pajamas, favorite dinosaur shirt"
                          : "e.g., blue dress, jeans and t-shirt, floral sundress"
                      }
                      className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Describe the outfit from that special memory
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Any other special details? (optional)
                    </label>
                    <textarea
                      value={attributes.customNotes}
                      onChange={(e) => setAttributes(prev => ({ ...prev, customNotes: e.target.value }))}
                      placeholder={
                        isBaby
                          ? "e.g., Holding favorite teddy bear, Had just learned to sit up, Making a funny face"
                          : "e.g., Wearing grandmother's necklace, Had paint on hands from art project"
                      }
                      className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Add any unique details you want to remember from this moment
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          
          {/* Preview */}
          <div className="mt-6 p-4 bg-purple-50 rounded-xl">
            <h4 className="font-semibold text-purple-900 mb-2">Preview Description:</h4>
            <p className="text-purple-700 italic">
              {buildDescription() || 'Fill in the fields above to see the description...'}
            </p>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-6 flex gap-4">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="btn-secondary"
            >
              Previous
            </button>
          )}
          
          <div className="flex-1" />
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!isValid()}
              className="btn-primary flex items-center gap-2"
            >
              <Check className="h-5 w-5" />
              Save Description
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}