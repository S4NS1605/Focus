import { useState } from 'react';
import Tesseract from 'tesseract.js';

export const useImageOCR = (onSuccess: (text: string) => void) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scanImage = async (file: File) => {
    setIsScanning(true);
    setProgress(0);
    setError(null);

    try {
      const result = await Tesseract.recognize(file, 'spa', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
          }
        }
      });
      
      const text = result.data.text;
      
      // 2. Replace newlines with spaces so it looks like a continuous sentence
      const cleanText = text.replace(/\n/g, ' ').trim();
      
      onSuccess(`[OCR] ${cleanText}`);
    } catch (err) {
      console.error(err);
      setError('No se pudo analizar la imagen.');
    } finally {
      setIsScanning(false);
      setProgress(0);
    }
  };

  return { scanImage, isScanning, progress, error };
};
