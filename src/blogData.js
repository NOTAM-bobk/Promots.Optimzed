// ── BLOG DATA ──────────────────────────────────────────────────────────────
// Add new blog posts to this array. Each post will automatically appear in
// The Prompt Lab. Fields: id, title, date, category, readTime, excerpt, content (Markdown-like string)

export const BLOG_POSTS = [
  {
    id: 'anatomy-of-a-perfect-prompt',
    title: 'The Anatomy of a Perfect Prompt',
    date: 'June 2025',
    category: 'Foundations',
    readTime: '6 min read',
    excerpt:
      'Most prompts fail not because the idea is wrong — but because the structure is missing. Learn the five layers every production-grade prompt needs.',
    content: `
## Why Most Prompts Underperform

You've probably noticed it: two people ask an AI the same question and get wildly different results. One gets a vague, hedged paragraph. The other gets a precise, actionable answer with exactly the right format and depth. The difference is rarely the model — it's the prompt.

After analyzing thousands of prompt-output pairs, five structural layers separate prompts that consistently deliver elite results from ones that don't.

---

## Layer 1 — Role Declaration

The first line of any serious prompt should prime the model's persona.

**Weak:** *"Help me write a cover letter."*
**Strong:** *"You are a senior talent acquisition specialist with 15 years of experience at Fortune 500 firms. You write cover letters that get callbacks."*

Role declaration isn't about flattery. It activates a specific latent reasoning pattern in the model — one trained on millions of documents written by people who actually occupy that role.

---

## Layer 2 — Context Loading

Models have no memory of your situation. Every implicit assumption in your head is invisible to them. The fix: make everything explicit.

Context should cover:
- **Domain** — What field or industry is this in?
- **Audience** — Who will read or use the output?
- **Tone register** — Formal, casual, technical, conversational?
- **Constraints** — What can't be changed? What's already decided?

Context isn't padding. Every sentence you add here reduces the probability space the model searches through, which directly improves output quality.

---

## Layer 3 — Task Precision

State the primary directive in one sentence. One. If your task statement needs a comma or a conjunction, split it.

**Vague:** *"Write something about our product launch and make it engaging and mention the new features."*
**Precise:** *"Write a 200-word product announcement for our B2B SaaS audience that leads with the core benefit of our new real-time sync feature."*

Precision here is the single highest-leverage edit you can make to any prompt.

---

## Layer 4 — Hard Constraints

Constraints feel restrictive but they're liberating for the model. They eliminate the combinatorial explosion of possible outputs and focus generation on exactly what you need.

Effective constraints specify:
- Word or section count limits
- What to explicitly exclude
- Required formatting (headers, bullets, code blocks)
- Language level or technical depth
- Tone prohibitions ("no corporate jargon", "no passive voice")

---

## Layer 5 — Output Format Specification

Don't let the model guess how to structure the response. Define it.

\`\`\`
Output format:
- Section 1: Executive Summary (2-3 sentences)
- Section 2: Key Findings (bulleted list, max 5 items)
- Section 3: Recommended Action (1 paragraph, imperative voice)
\`\`\`

When the model knows exactly what the finished product looks like, it can reverse-engineer from that target. The output becomes predictable — and predictable in production systems is priceless.

---

## Putting It Together

Every prompt you write should be able to answer: *Could a model with zero prior context execute this flawlessly?* If the answer is no — add context, tighten the task, or define the format more precisely.

The five layers aren't a formula. They're a diagnostic. Use them to audit why a prompt is failing, and you'll know exactly where to fix it.
    `.trim(),
  },
  // ── ADD MORE POSTS BELOW ──────────────────────────────────────────────────
  // {
  //   id: 'your-post-slug',
  //   title: 'Your Post Title',
  //   date: 'Month YYYY',
  //   category: 'Category',
  //   readTime: 'X min read',
  //   excerpt: 'Short summary shown on the blog index card.',
  //   content: `Your full post content here. Supports ## headings, **bold**, bullet lists, and \`\`\` code blocks.`,
  // },
];
