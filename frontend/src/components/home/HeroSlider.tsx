import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchSliders, resolveMediaUrl } from "../../lib/api";
import type { SliderPoster } from "../../types/content";
import type { Category } from "../../types/product";

const AUTO_ADVANCE_MS = 5000;

interface HeroSliderProps {
  categories: Category[];
}

export function HeroSlider({ categories }: HeroSliderProps) {
  const [slides, setSlides] = useState<SliderPoster[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSliders()
      .then((data) => {
        if (!cancelled) setSlides(data);
      })
      .catch(() => {
        // No sliders is a valid, quiet state — the section just won't render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  function goTo(i: number) {
    setIndex((i + slides.length) % slides.length);
  }

  if (slides.length === 0) return null;

  const slide = slides[index];
  // link_category stores a category slug (deliberately not a category_id
  // FK — see the backend's SliderPoster model); resolve it against the
  // currently fetched categories to build the filtered link, falling back
  // to home if it's empty or no longer matches any category.
  const linkedCategory = categories.find((c) => c.slug === slide.link_category);
  const to = linkedCategory ? `/?category_id=${linkedCategory.id}` : "/";
  const alt = linkedCategory ? linkedCategory.name : "Kalour Beauty Empire";

  return (
    <section
      className="relative overflow-hidden rounded-sm border border-line"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Link to={to} className="block aspect-[21/9] w-full sm:aspect-[3/1]">
        <img
          src={resolveMediaUrl(slide.image_url)}
          alt={alt}
          // Almost always this page's LCP element — the opposite of
          // ProductCard's lazy grid images, this one should load and
          // decode as early and eagerly as possible.
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </Link>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Kipengele kilichopita"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-black shadow-sm transition hover:bg-white"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Kipengele kinachofuata"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-black shadow-sm transition hover:bg-white"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Nenda kwenye kipengele ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
