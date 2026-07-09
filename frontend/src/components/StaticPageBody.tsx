interface StaticPageBodyProps {
  body: string;
}

// Renders admin-edited plain text: blocks are separated by a blank line;
// a block starting with "## " renders as a section heading instead of a
// paragraph. Keeps the admin editor a plain textarea while still allowing
// the Privacy/Terms-style sectioned layout the site previously hardcoded.
export function StaticPageBody({ body }: StaticPageBodyProps) {
  const blocks = body.split(/\n\s*\n/).filter((block) => block.trim());

  return (
    <div className="flex flex-col gap-5 text-ink-muted">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="-mb-2 text-lg font-bold text-ink">
              {block.slice(3).trim()}
            </h2>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {block.trim()}
          </p>
        );
      })}
    </div>
  );
}
