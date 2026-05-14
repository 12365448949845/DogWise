import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Magnet from '@/components/Magnet';

const FRAME_COUNT = 500;
const DB_NAME = 'videoFramesCache';
const STORE_NAME = 'frames';
const CACHE_KEY = 'dog-hero-500';

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadCachedFrames(): Promise<Blob[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function saveCachedFrames(blobs: Blob[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blobs, CACHE_KEY);
  } catch { /* silent */ }
}

const ScrollVideoHero = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoFallbackRef = useRef<HTMLVideoElement>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    const initFrames = async () => {
      // Try loading from IndexedDB cache first
      const cached = await loadCachedFrames();
      if (cached && cached.length === FRAME_COUNT) {
        const bitmaps = await Promise.all(cached.map(b => createImageBitmap(b)));
        if (cancelled) return;

        framesRef.current = bitmaps;
        canvas.width = bitmaps[0].width;
        canvas.height = bitmaps[0].height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(bitmaps[0], 0, 0);
        setLoading(false);
        return;
      }

      // No cache — extract from video
      const video = document.createElement('video');
      video.src = '/videos/dog-hero.mp4';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      await new Promise<void>((resolve) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      });
      if (cancelled) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;

      const offscreen = new OffscreenCanvas(w, h);
      const offCtx = offscreen.getContext('2d')!;
      const frames: ImageBitmap[] = [];
      const blobs: Blob[] = [];
      const duration = video.duration;

      for (let i = 0; i < FRAME_COUNT; i++) {
        if (cancelled) return;
        const time = (i / (FRAME_COUNT - 1)) * duration;

        await new Promise<void>((resolve) => {
          video.addEventListener('seeked', () => resolve(), { once: true });
          video.currentTime = time;
        });

        offCtx.drawImage(video, 0, 0, w, h);

        const [bitmap, blob] = await Promise.all([
          createImageBitmap(offscreen),
          offscreen.convertToBlob({ type: 'image/webp', quality: 0.8 }),
        ]);
        frames.push(bitmap);
        blobs.push(blob);
      }

      if (cancelled) return;

      framesRef.current = frames;
      setLoading(false);

      const ctx = canvas.getContext('2d');
      if (ctx && frames[0]) ctx.drawImage(frames[0], 0, 0);

      // Save to IndexedDB for next visit
      saveCachedFrames(blobs);
    };

    initFrames();

    return () => { cancelled = true; };
  }, []);

  // Scroll-driven rendering (canvas when ready, video.currentTime as fallback)
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const fallbackVideo = videoFallbackRef.current;
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let lastFrame = -1;

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const scrollableHeight = section.offsetHeight - window.innerHeight;

      let progress = 0;
      if (scrollableHeight > 0) {
        progress = Math.min(1, Math.max(0, -rect.top / scrollableHeight));
      }

      const frames = framesRef.current;
      if (frames.length > 0) {
        // Canvas mode: smooth frame drawing
        const frameIndex = Math.min(frames.length - 1, Math.floor(progress * (frames.length - 1)));
        if (frameIndex !== lastFrame) {
          ctx.drawImage(frames[frameIndex], 0, 0, canvas.width, canvas.height);
          lastFrame = frameIndex;
        }
      } else if (fallbackVideo && fallbackVideo.duration) {
        // Fallback: scroll-driven video seeking
        fallbackVideo.currentTime = progress * fallbackVideo.duration;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [loading]);

  return (
    <section
      ref={sectionRef}
      className="relative -mt-16"
      style={{ height: '300vh' }}
    >
      {/* Sticky video container */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Video fallback: scroll-driven while frames extract */}
        <video
          ref={videoFallbackRef}
          className="absolute inset-0 w-full h-full object-cover z-[1]"
          style={{ opacity: loading ? 1 : 0 }}
          muted
          playsInline
          preload="auto"
        >
          <source src="/videos/dog-hero.mp4" type="video/mp4" />
        </video>
        {/* Canvas-based frame rendering */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover z-[2]"
          style={{ opacity: loading ? 0 : 1 }}
        />

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="text-center px-4 max-w-4xl">
            <h1 className="text-5xl md:text-8xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
              DogWorld
            </h1>
            <p className="text-lg md:text-2xl text-white/85 font-light drop-shadow-lg">
              每一只狗狗，都值得被世界温柔以待
            </p>
          </div>

          {/* Bottom CTA */}
          <div className="absolute bottom-24 flex items-center gap-4">
            <Magnet padding={50} magnetStrength={2}>
              <Link
                to="/discover"
                className="px-8 py-3 bg-amber-500 text-white font-bold rounded-full hover:bg-amber-600 transition-all shadow-xl text-base hover:scale-105"
              >
                开始探索
              </Link>
            </Magnet>
            <Magnet padding={50} magnetStrength={2}>
              <Link
                to="/register"
                className="px-8 py-3 bg-white/15 text-white font-bold rounded-full hover:bg-white/25 transition-all backdrop-blur-md border border-white/30 text-base hover:scale-105"
              >
                立即加入
              </Link>
            </Magnet>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-8 animate-bounce">
            <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScrollVideoHero;
