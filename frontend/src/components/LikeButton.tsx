import { useState } from "react";
import { Heart } from "lucide-react";
import { likeProduct } from "../lib/api";

interface LikeButtonProps {
  productId: string;
  initialCount: number;
}

const LIKED_KEY_PREFIX = "kalour_liked_";

export function LikeButton({ productId, initialCount }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(
    () => localStorage.getItem(LIKED_KEY_PREFIX + productId) === "1",
  );
  const [pending, setPending] = useState(false);

  async function handleLike() {
    if (liked || pending) return;
    setPending(true);
    setCount((c) => c + 1);
    setLiked(true);

    try {
      const result = await likeProduct(productId);
      setCount(result.like_count);
      localStorage.setItem(LIKED_KEY_PREFIX + productId, "1");
    } catch {
      setCount((c) => c - 1);
      setLiked(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={liked || pending}
      aria-pressed={liked}
      className={`flex shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        liked
          ? "border-brand-accent text-brand-accent"
          : "border-line text-ink-muted hover:border-brand-accent hover:text-brand-accent"
      }`}
    >
      <Heart size={16} className={liked ? "fill-brand-accent" : ""} />
      <span>{count}</span>
    </button>
  );
}
