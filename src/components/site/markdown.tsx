import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "@/lib/slug";

function text(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(text).join("");
  return "";
}

/** Blog ve SEO içerikleri için markdown. Başlıklara çapa id'leri eklenir (içindekiler tablosu için). */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 id={slugify(text(children))}>{children}</h2>,
          h2: ({ children }) => <h2 id={slugify(text(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugify(text(children))}>{children}</h3>,
          a: ({ href, children }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
                {children}
              </a>
            );
          },
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Markdown'daki H2'lerden içindekiler listesi üretir. */
export function extractHeadings(content: string) {
  return Array.from(content.matchAll(/^##\s+(.+)$/gm)).map((m) => {
    const label = m[1].replace(/[*_`[\]]/g, "").trim();
    return { id: slugify(label), label };
  });
}

/** SSS bölümündeki "### Soru" + paragraf çiftlerini FAQPage JSON-LD için çıkarır. */
export function extractFaq(content: string) {
  const faqStart = content.search(/^##\s+.*(sık sorulan|sss|faq)/im);
  if (faqStart < 0) return [];
  const section = content.slice(faqStart).split(/^##\s+/m)[1] ?? "";
  return Array.from(section.matchAll(/^###\s+(.+)\n+([\s\S]*?)(?=^###\s+|$(?![\s\S]))/gm))
    .map((m) => ({ q: m[1].trim(), a: m[2].replace(/\n+/g, " ").trim() }))
    .filter((x) => x.q && x.a)
    .slice(0, 10);
}
