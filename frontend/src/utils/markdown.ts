import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}
