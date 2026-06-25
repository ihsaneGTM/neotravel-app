import type { ReactNode } from "react";

/** Rendu markdown léger (gras **, italique *, code `, listes -, retours ligne) — zéro dépendance. */
function inline(s: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[2] != null) out.push(<strong key={`${keyBase}-${k}`}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<strong key={`${keyBase}-${k}`}>{m[3]}</strong>);
    else if (m[4] != null) out.push(<em key={`${keyBase}-${k}`}>{m[4]}</em>);
    else if (m[5] != null) out.push(<code key={`${keyBase}-${k}`} className="rounded bg-black/5 px-1 py-0.5 text-[0.85em]">{m[5]}</code>);
    last = re.lastIndex;
    k++;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = (i: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${i}`} className="my-1 list-disc space-y-0.5 pl-4">
        {list.map((li, j) => <li key={j}>{inline(li, `li-${i}-${j}`)}</li>)}
      </ul>
    );
    list = [];
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    const bullet = t.match(/^[-*•]\s+(.*)/);
    const numbered = t.match(/^\d+[.)]\s+(.*)/);
    if (bullet) list.push(bullet[1]);
    else if (numbered) list.push(numbered[1]);
    else {
      flush(i);
      if (t) blocks.push(<p key={`p-${i}`} className="my-0.5">{inline(t, `p-${i}`)}</p>);
    }
  });
  flush(lines.length);
  return <>{blocks}</>;
}
