import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Styles the item as a destructive action (brand-red text). */
  danger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
}

const VIEWPORT_GUTTER = 8;

/**
 * Standard three-dot row-action menu for admin tables — replaces a row of
 * separate icon buttons with a single trigger, so tables stay uncluttered
 * as more actions get added per module. Callers are responsible for
 * filtering `items` down to what the current user's permissions allow;
 * this component only renders whatever it's given.
 *
 * The dropdown renders through a portal onto document.body with fixed
 * positioning, so it can never be clipped by the table wrapper's
 * overflow-hidden (which used to swallow the menu on the last rows) or any
 * other scroll container. Placement is measured after render: it opens
 * below the trigger, flips above when there isn't room, and is clamped
 * inside the viewport horizontally. Any scroll or resize closes it — with
 * fixed positioning the menu would otherwise drift away from its row.
 */
export function ActionMenu({ items, ariaLabel = "Vitendo" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // First paint after opening renders the menu invisibly (pos === null),
  // this measures its real size, then positions it — no height guessing.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;

    const fitsBelow =
      rect.bottom + 4 + menuHeight + VIEWPORT_GUTTER <= window.innerHeight;
    const top = fitsBelow
      ? rect.bottom + 4
      : Math.max(VIEWPORT_GUTTER, rect.top - menuHeight - 4);
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - VIEWPORT_GUTTER),
    );

    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleClose() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    // Capture-phase scroll: catches scrolling inside nested containers too.
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-hover hover:text-brand-accent"
      >
        <MoreHorizontal size={18} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={
              pos
                ? { top: pos.top, left: pos.left }
                : { top: 0, left: 0, visibility: "hidden" }
            }
            className="fixed z-[300] w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger
                    ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    : "text-ink hover:bg-surface-hover"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
