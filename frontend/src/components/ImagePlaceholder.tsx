import { ImageOff } from "lucide-react";

interface ImagePlaceholderProps {
  iconSize?: number;
}

export function ImagePlaceholder({ iconSize = 36 }: ImagePlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-muted/60">
      <ImageOff size={iconSize} strokeWidth={1.5} />
      <span className="text-sm">Hakuna Picha</span>
    </div>
  );
}
