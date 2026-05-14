import { useRef, useState, useEffect } from 'react';
import Matter from 'matter-js';

interface FallingTextProps {
  text?: string;
  highlightWords?: string[];
  trigger?: 'auto' | 'scroll' | 'click' | 'hover';
  backgroundColor?: string;
  wireframes?: boolean;
  gravity?: number;
  mouseConstraintStiffness?: number;
  fontSize?: string;
}

const FallingText: React.FC<FallingTextProps> = ({
  text = '',
  highlightWords = [],
  trigger = 'auto',
  backgroundColor = 'transparent',
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  fontSize = '1rem'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // readyCount increments every time the component enters the viewport (resets state)
  // effectCounter increments when hover/click triggers the fall
  const [readyCount, setReadyCount] = useState(trigger === 'auto' ? 1 : 0);
  const [effectCounter, setEffectCounter] = useState(trigger === 'auto' ? 1 : 0);
  const isReadyRef = useRef(trigger === 'auto');

  // Rebuild text spans whenever readyCount changes (entering viewport = reset)
  useEffect(() => {
    if (!textRef.current) return;
    const words = text.split(' ');
    const newHTML = words
      .map(word => {
        const isHighlighted = highlightWords.some(hw => word.startsWith(hw));
        return `<span
          class="inline-block mx-[2px] select-none ${isHighlighted ? 'text-amber-500 font-bold' : ''}"
        >
          ${word}
        </span>`;
      })
      .join(' ');
    textRef.current.innerHTML = newHTML;
  }, [text, highlightWords, readyCount]);

  // IntersectionObserver: entering viewport → reset ready state
  useEffect(() => {
    if (trigger === 'auto') return;
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          isReadyRef.current = true;
          setReadyCount(c => c + 1);
        } else {
          isReadyRef.current = false;
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [trigger]);

  useEffect(() => {
    if (effectCounter === 0) return;

    // Re-render text HTML so spans are fresh DOM nodes
    if (textRef.current) {
      const words = text.split(' ');
      const newHTML = words
        .map(word => {
          const isHighlighted = highlightWords.some(hw => word.startsWith(hw));
          return `<span
            class="inline-block mx-[2px] select-none ${isHighlighted ? 'text-amber-500 font-bold' : ''}"
          >
            ${word}
          </span>`;
        })
        .join(' ');
      textRef.current.innerHTML = newHTML;
    }

    const { Engine, Render, World, Bodies, Runner, Mouse, MouseConstraint } = Matter;

    if (!containerRef.current || !canvasContainerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) return;

    const engine = Engine.create();
    engine.world.gravity.y = gravity;

    const render = Render.create({
      element: canvasContainerRef.current,
      engine,
      options: {
        width,
        height,
        background: backgroundColor,
        wireframes
      }
    });

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    };
    const wallThickness = 500;
    const floor = Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness, wallThickness, boundaryOptions);
    const leftWall = Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness, boundaryOptions);
    const rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness, wallThickness, boundaryOptions);

    if (!textRef.current) return;
    const wordSpans = textRef.current.querySelectorAll('span');
    const wordBodies = Array.from(wordSpans).map(elem => {
      const rect = elem.getBoundingClientRect();

      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: 'transparent' },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2
      });
      Matter.Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 5,
        y: 0
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);

      return { elem, body };
    });

    wordBodies.forEach(({ elem, body }) => {
      elem.style.position = 'absolute';
      elem.style.left = `${body.position.x - body.bounds.max.x + body.bounds.min.x / 2}px`;
      elem.style.top = `${body.position.y - body.bounds.max.y + body.bounds.min.y / 2}px`;
      elem.style.transform = 'none';
    });

    const mouse = Mouse.create(containerRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: mouseConstraintStiffness,
        render: { visible: false }
      }
    });
    render.mouse = mouse;

    World.add(engine.world, [floor, leftWall, rightWall, ceiling, mouseConstraint, ...wordBodies.map(wb => wb.body)]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    const updateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
        // Clamp position: if a body escapes, reset it back inside
        const bx = body.position.x;
        const by = body.position.y;
        if (bx < 0 || bx > width || by < 0 || by > height) {
          Matter.Body.setPosition(body, {
            x: Math.max(10, Math.min(width - 10, bx)),
            y: Math.max(10, Math.min(height - 10, by))
          });
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
        }
        const { x, y } = body.position;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
      Matter.Engine.update(engine);
      requestAnimationFrame(updateLoop);
    };
    updateLoop();

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas && canvasContainerRef.current) {
        canvasContainerRef.current.removeChild(render.canvas);
      }
      World.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [effectCounter, gravity, wireframes, backgroundColor, mouseConstraintStiffness, text, highlightWords]);

  const handleTrigger = () => {
    if (trigger === 'click' || trigger === 'hover') {
      if (!isReadyRef.current) return;
      isReadyRef.current = false;
      setEffectCounter(c => c + 1);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative z-[1] w-full h-full cursor-pointer text-center pt-8 overflow-hidden"
      onClick={trigger === 'click' ? handleTrigger : undefined}
      onMouseEnter={trigger === 'hover' ? handleTrigger : undefined}
    >
      <div
        ref={textRef}
        className="inline-block"
        style={{
          fontSize,
          lineHeight: 1.4
        }}
      />

      <div className="absolute top-0 left-0 z-0" ref={canvasContainerRef} />
    </div>
  );
};

export default FallingText;
