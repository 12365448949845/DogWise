import { useState, useRef, type ChangeEvent } from 'react';
import { uploadApi } from '@/services/uploadApi';
import { getImageUrl } from '@/utils/image';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
  variant?: 'cover' | 'avatar';
}


const ImageUpload = ({ value, onChange, className = '', variant = 'cover' }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const res = await uploadApi.uploadImage(file);
      onChange(res.data.url);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fullUrl = value ? getImageUrl(value) : '';

  const isAvatar = variant === 'avatar';

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      {isAvatar ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden hover:border-indigo-500 transition-colors"
        >
          {uploading ? (
            <span className="text-xs text-gray-400">Uploading...</span>
          ) : fullUrl ? (
            <img src={fullUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-gray-400">+</span>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors overflow-hidden"
        >
          {uploading ? (
            <span className="text-sm text-gray-400">Uploading...</span>
          ) : fullUrl ? (
            <img src={fullUrl} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <>
              <span className="text-3xl text-gray-400 mb-1">📷</span>
              <span className="text-xs text-gray-400">Click to upload cover image</span>
              <span className="text-xs text-gray-400 mt-0.5">JPEG, PNG, GIF, WebP · Max 5MB</span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default ImageUpload;
