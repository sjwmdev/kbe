import { useState } from "react";
import { Heart } from "lucide-react";
import { likeProduct, unlikeProduct } from "../lib/api";

interface LikeButtonProps {
  productId: string;
  initialCount: number;
}

const LIKED_KEY_PREFIX = "kalour_liked_";

// There's no customer login on this storefront (WhatsApp-negotiated sales,
// no accounts), so "did I like this" has nowhere to live server-side per
// visitor — localStorage is the practical stand-in, persisting the toggle
// across reloads on the same device the same way a logged-in user's state
// would.
export function LikeButton({ productId, initialCount }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(
    () => localStorage.getItem(LIKED_KEY_PREFIX + productId) === "1",
  );
  const [pending, setPending] = useState(false);
  // Bumped on every successful toggle so the heart's animation class
  // remounts (and therefore replays) even though "liked" itself might
  // briefly be the same value during a rapid double toggle.
  const [pulse, setPulse] = useState(0);

  async function handleToggle() {
    if (pending) return;
    const wasLiked = liked;
    setPending(true);
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));
    setPulse((p) => p + 1);

    try {
      const result = wasLiked
        ? await unlikeProduct(productId)
        : await likeProduct(productId);
      setCount(result.like_count);
      if (wasLiked) {
        localStorage.removeItem(LIKED_KEY_PREFIX + productId);
      } else {
        localStorage.setItem(LIKED_KEY_PREFIX + productId, "1");
      }
    } catch {
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "Ondoa kupenda" : "Penda bidhaa hii"}
      className={`flex shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-70 ${
        liked
          ? "border-brand-accent text-brand-accent"
          : "border-line text-ink-muted hover:border-brand-accent hover:text-brand-accent"
      }`}
    >
      <Heart
        key={pulse}
        size={16}
        className={`${liked ? "fill-brand-accent" : ""} ${
          pulse === 0
            ? ""
            : liked
              ? "animate-[heart-like-pop_0.45s_ease-out]"
              : "animate-[heart-unlike-dip_0.3s_ease-out]"
        }`}
      />
      <span>{count}</span>
    </button>
  );
}
