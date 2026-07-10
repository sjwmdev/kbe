import { useEffect, useRef } from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

const COLOR_SWATCHES = ["#111827", "#b80049", "#2563eb", "#16a34a", "#92400e"];

/**
 * Minimal WYSIWYG editor for product descriptions — a contentEditable
 * surface driven by execCommand. No new dependency: the feature set asked
 * for (bold/italic/underline, headings, lists, links, basic alignment,
 * text color) is exactly what execCommand already covers natively in every
 * evergreen browser, so pulling in a full editor framework (TipTap/Quill)
 * would be a lot of extra weight for the same result. The stored HTML is
 * sanitized server-side (see backend's SanitizeDescriptionHTML) before
 * it's ever persisted or rendered back, so this editor doesn't need to be
 * trusted on its own.
 */
export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // The contenteditable surface is deliberately uncontrolled: rewriting
  // innerHTML on every render (the old dangerouslySetInnerHTML={{__html:
  // value}} approach) destroys the browser's caret position each keystroke
  // — the cursor jumped to the start and new text interleaved with old.
  // Instead, the DOM owns the content while typing, and the external value
  // is written in only when it actually differs (initial mount, loading an
  // existing product into the form, a form reset) — during normal typing
  // value === innerHTML already, so this never touches the DOM.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function handleLink() {
    const url = window.prompt("Weka anwani (URL) ya kiungo:", "https://");
    if (!url) return;
    exec("createLink", url);
  }

  return (
    <div className="rounded-lg border border-line bg-surface-hover">
      <div className="flex flex-wrap items-center gap-1 border-b border-line p-2">
        <button
          type="button"
          onClick={() => exec("bold")}
          aria-label="Nzito"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          aria-label="Mlalo"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          aria-label="Mstari Chini"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <Underline size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button
          type="button"
          onClick={() => exec("formatBlock", "H2")}
          aria-label="Kichwa"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          aria-label="Orodha"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          aria-label="Orodha ya Namba"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          onClick={handleLink}
          aria-label="Kiungo"
          className="rounded p-1.5 text-ink-muted hover:bg-surface hover:text-brand-accent"
        >
          <LinkIcon size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => exec("foreColor", hex)}
            aria-label={`Rangi ${hex}`}
            style={{ backgroundColor: hex }}
            className="h-5 w-5 rounded-full border border-line"
          />
        ))}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="min-h-[10rem] whitespace-pre-wrap px-4 py-3 text-ink outline-none [&_a]:text-brand-accent [&_a]:underline [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
      />
    </div>
  );
}
