// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('renders headings, lists, and tables', () => {
    const html = renderMarkdown('# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code>');
    expect(html).toContain('const x = 1;');
  });

  it('turns single line breaks into <br>', () => {
    const html = renderMarkdown('line one\nline two');
    expect(html).toContain('line one<br>line two');
  });

  it('strips script tags', () => {
    const html = renderMarkdown('hello\n<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('hello');
  });
});
