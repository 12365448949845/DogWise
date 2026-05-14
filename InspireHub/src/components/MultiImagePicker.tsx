import { useState, useRef, useCallback, memo } from 'react';
import { uploadApi } from '@/services/uploadApi';
import { getImageUrl } from '@/utils/image';

interface MultiImagePickerProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}

const MultiImagePicker = memo(({ images, onChange, max = 9 }: MultiImagePickerProps) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const res = await uploadApi.uploadImage(file);
        uploaded.push(res.data.url);
      }
      onChange([...images, ...uploaded].slice(0, max));
    } catch { /* silent */ }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [images, onChange, max]);

  const remove = useCallback((idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  }, [images, onChange]);

  const trigger = useCallback(() => {
    fileRef.current?.click();
  }, []);

  return (
    <>
      {/* Thumbnail previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative group/img">
              <img
                src={url.startsWith('http') ? url : getImageUrl(url)}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 hover:bg-red-500 transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger button + hidden input */}
      <button
        type="button"
        onClick={trigger}
        disabled={uploading || images.length >= max}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors text-base disabled:opacity-50"
        title="上传图片"
      >
        🖼️
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      {uploading && <span className="text-xs text-gray-400 ml-1">上传中...</span>}
    </>
  );
});

MultiImagePicker.displayName = 'MultiImagePicker';
export default MultiImagePicker;
