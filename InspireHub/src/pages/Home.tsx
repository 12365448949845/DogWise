import { Link } from 'react-router-dom';
import ScrollVideoHero from '@/components/ScrollVideoHero';
import ScrollFloat from '@/components/ScrollFloat';
import Stack from '@/components/Stack';
import CountUp from '@/components/CountUp';
import Ballpit from '@/components/Ballpit';
import DomeGallery from '@/components/DomeGallery';
import FlowingMenu from '@/components/FlowingMenu';
import FallingText from '@/components/FallingText';
import Magnet from '@/components/Magnet';

const Home = () => {

  return (
    <div className="min-h-screen">
      {/* Scroll Video Hero */}
      <ScrollVideoHero />

      {/* Scroll Float Intro */}
      <section className="py-28 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center gap-12">
          {/* Left: interactive card stack */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-72 h-80 md:w-80 md:h-96">
              <Stack
                randomRotation={false}
                sensitivity={180}
                sendToBackOnClick={true}
                autoplay={true}
                autoplayDelay={4000}
                pauseOnHover={true}
                cards={[
                  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80',
                  'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=600&q=80',
                  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
                  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80',
                  'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=600&q=80',
                ].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`dog-${i + 1}`}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                ))}
              />
            </div>
          </div>
          {/* Right: text */}
          <div className="flex-1">
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="top bottom"
              scrollEnd="center center"
              stagger={0.03}
              containerClassName="mb-2"
              textClassName="font-black text-gray-900 dark:text-white text-[clamp(2rem,5vw,3.5rem)]"
            >
              每一只狗狗
            </ScrollFloat>
            <ScrollFloat
              animationDuration={1}
              ease="back.inOut(2)"
              scrollStart="top bottom"
              scrollEnd="center center"
              stagger={0.03}
              containerClassName="mb-6"
              textClassName="font-black text-amber-500 text-[clamp(2rem,5vw,3.5rem)]"
            >
              都值得被了解
            </ScrollFloat>
            <ScrollFloat
              animationDuration={0.8}
              ease="back.inOut(1.5)"
              scrollStart="top bottom"
              scrollEnd="center center+=20%"
              stagger={0.015}
              containerClassName="mb-2"
              textClassName="text-gray-500 dark:text-gray-400 text-sm font-normal"
            >
              200+ 犬种详解，50,000+ 知识帖子，AI 全天候问答。
            </ScrollFloat>
            <ScrollFloat
              animationDuration={0.8}
              ease="back.inOut(1.5)"
              scrollStart="top bottom"
              scrollEnd="center center+=20%"
              stagger={0.015}
              containerClassName="mb-6"
              textClassName="text-gray-500 dark:text-gray-400 text-sm font-normal"
            >
              无论你是新手铲屎官还是资深狗爸狗妈，这里都有你需要的一切。
            </ScrollFloat>
          </div>
        </div>
      </section>

      {/* Flowing Menu */}
      <section style={{ height: '600px', position: 'relative' }}>
        <FlowingMenu
          items={[
            { link: '/discover', text: '发现', image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=600&q=80' },
            { link: '/knowledge', text: '知识库', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=600&q=80' },
            { link: '/ai', text: 'AI 问答', image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80' },
            { link: '/write', text: '发布', image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80' },
          ]}
          speed={15}
          textColor="#f59e0b"
          bgColor="#111827"
          marqueeBgColor="#f59e0b"
          marqueeTextColor="#111827"
          borderColor="#f59e0b40"
        />
      </section>

      {/* Dome Gallery */}
      <section className="relative bg-gray-900" style={{ width: '100%', height: 'calc(100vh - 4rem)' }}>
        <DomeGallery
          fit={0.8}
          minRadius={600}
          maxVerticalRotationDeg={11}
          segments={34}
          dragDampening={2}
          grayscale={false}
          overlayBlurColor="#111827"
          imageBorderRadius="16px"
          openedImageBorderRadius="16px"
        />
      </section>

      {/* Featured Breeds */}
      <section className="bg-gray-50 dark:bg-gray-900/60 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">🐕 热门犬种</h2>
            <Magnet padding={40} magnetStrength={3}>
              <Link to="/knowledge" className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                查看全部 →
              </Link>
            </Magnet>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: '280px' }}>
            <FallingText
              text="🦮金毛寻回犬 温顺友善 🐕柴犬 忠诚独立 🐾边境牧羊犬 聪明机敏 🐺哈士奇 活泼搞怪 🐶拉布拉多 亲人温和 🍑柯基 短腿萌物 🐩泰迪 聪明粘人 🦴德牧 勇敢忠诚 🐕‍🦺阿拉斯加 温柔憨厚 萨摩耶 微笑天使"
              highlightWords={['金毛寻回犬', '柴犬', '边境牧羊犬', '哈士奇', '拉布拉多', '柯基', '泰迪', '德牧', '阿拉斯加', '萨摩耶']}
              trigger="hover"
              backgroundColor="transparent"
              gravity={0.6}
              mouseConstraintStiffness={0.3}
              fontSize="1.75rem"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            { to: 10000, suffix: '+', label: '铲屎官', icon: '👥', duration: 2 },
            { to: 50000, suffix: '+', label: '知识帖子', icon: '📝', duration: 2.5 },
            { to: 200, suffix: '+', label: '犬种百科', icon: '🐕', duration: 1.5 },
            { to: 24, suffix: '/7', label: 'AI 在线答疑', icon: '🤖', duration: 1 },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-2xl font-extrabold text-amber-600 mb-1">
                <CountUp from={0} to={s.to} separator="," duration={s.duration} direction="up" />
                {s.suffix}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA with dog background */}
      <section className="relative overflow-hidden" style={{ width: '100%', height: 'calc(100vh - 4rem)' }}>
        {/* Dog welcome background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1920&q=80)' }}
        />
        {/* Warm overlay */}
        <div className="absolute inset-0 bg-amber-900/50" />
        {/* Ballpit on top */}
        <div className="absolute inset-0">
          <Ballpit
            count={80}
            gravity={0.01}
            friction={0.9975}
            wallBounce={0.95}
            followCursor={true}
            colors={[0xf59e0b, 0xfbbf24, 0xf97316, 0xfb923c, 0xfde68a]}
            className="absolute inset-0"
          />
        </div>
        {/* Overlay text */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center pointer-events-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-lg">加入 DogWorld，和万千铲屎官一起交流</h2>
            <p className="text-amber-100 mb-6 text-sm drop-shadow">无论你是新手铲屎官还是养狗多年的达人，这里都有你需要的知识和伙伴</p>
            <Magnet padding={60} magnetStrength={2}>
              <Link
                to="/register"
                className="inline-block px-8 py-3 bg-white text-amber-600 font-bold rounded-xl hover:bg-amber-50 transition-colors shadow-lg text-sm"
              >
                免费注册
              </Link>
            </Magnet>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
