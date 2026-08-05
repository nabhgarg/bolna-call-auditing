import assets from "../../../../lib/merlin-assets.json";

// Source documents behind [ASSET:NAME] placeholders in the review prompts.
// A reviewer judging whether a summary is faithful has to be able to read the
// original — this serves it on our own domain, no external links. Only the
// documents themselves ship here: assets.md's GROUND TRUTH section is stripped
// at build time (build_web_items.py), so answers never reach a reviewer.

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(assets as Record<string, string>).map((name) => ({ name }));
}

// Documents are stored as markdown blockquotes / fenced blocks. Strip the
// quoting so the reader sees the plain document, and keep table-ish data
// monospaced.
function clean(src: string) {
  const fenced = src.includes("```");
  const body = src
    .replace(/^```[a-z]*\n?/gm, "")
    .replace(/^```$/gm, "")
    .split("\n")
    .map((l) => l.replace(/^>\s?/, ""))
    .join("\n")
    .replace(/\*\*/g, "")
    .trim();
  return { body, mono: fenced };
}

export default async function SourceDoc({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const raw = (assets as Record<string, string>)[name];

  if (!raw) {
    return (
      <main style={wrap}>
        <p style={{ color: "var(--muted)" }}>
          No source document called <b>{name}</b>.
        </p>
      </main>
    );
  }

  const { body, mono } = clean(raw);
  return (
    <main style={wrap}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>
          Source document
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
          {name}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
        This is the text the question refers to. Judge each answer against what
        is actually written here.
      </p>
      <article
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "18px 20px",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
          fontSize: mono ? 13 : 15,
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          overflowX: "auto"
        }}
      >
        {body}
      </article>
    </main>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "28px 20px 60px"
};
