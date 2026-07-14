# SEO Implementation Guide

**Location:** `.dev/docs/prds/`  
**Purpose:** Instructions for implementing SEO updates based on canonical messaging and technical specifications

---

## Documents in This Folder

### 1. **seo.md** — Source of Truth for SEO Copy & Messaging
- **Audience:** Marketing, copywriters, AI agents implementing SEO updates
- **Contains:** 
  - Company descriptions and brand story
  - Page-by-page headlines, subheadings, and messaging
  - Key messaging pillars
  - Keywords and keyword strategy
  - Customer testimonials
  - Competitive positioning
  - Brand naming guidance (Finperiti vs finperiti)

**Use this when:**
- Writing or updating page titles, meta descriptions, headings
- Creating new marketing copy for SEO
- Updating Open Graph or Twitter Card descriptions
- Implementing schema.org structured data descriptions
- Updating any customer-facing copy on the website

### 2. **seo-optimization.md** — Technical Reference for SEO Implementation
- **Audience:** Developers, SEO auditors, technical validators
- **Contains:**
  - What SEO implementations were completed (WRK-21)
  - Files created (robots.txt, sitemap.xml, 404.html, humans.txt)
  - Pages updated and their exact metadata
  - Schema.org markup specifications
  - Technical implementation details
  - Brand name capitalization rules for code/markup

**Use this when:**
- Validating SEO technical implementation
- Understanding what was implemented and why
- Checking schema.org markup correctness
- Auditing SEO infrastructure (canonical URLs, robots.txt, etc.)
- Referencing exact file locations and technical specs

---

## How to Implement SEO Updates

### Step 1: Define What Needs Updating
Identify which page or content needs an SEO update:
- Home page → index.html
- About page → about.html
- Pricing page → pricing.html
- Contact page → contact.html
- Other pages as needed

### Step 2: Check seo.md for Canonical Copy
**Always start with `seo.md`** — this is your source of truth for:
- **Page Headline:** What should the main H1 say?
- **Meta Description:** What's the optimal page description for search results?
- **Key Messages:** What are the core value propositions to emphasize?
- **Keywords:** Which keywords should this page target?

### Step 3: Update Website Files
Apply the copy from seo.md to the appropriate HTML files:

**Example: Updating Home Page Title & Description**
- Read `seo.md` → Home Page section
- Get the required title and meta description
- Update `index.html` page title and meta description tags
- Update Open Graph tags (og:title, og:description)
- Update Twitter Card tags (twitter:title, twitter:description)

### Step 4: Reference seo-optimization.md for Technical Details
If you need to understand:
- What exact schema.org markup should be used
- Which files implement what features
- Technical implementation requirements
- Validation requirements

...consult `seo-optimization.md` for technical specs.

### Step 5: Validate Against Branding Guidelines
**Brand naming rules (from seo.md):**
- **"Finperiti"** (capitalized) — Use in schema.org markup and company references
- **"finperiti"** (lowercase) — Use in page titles, meta descriptions, body copy, product references

---

## Common SEO Implementation Tasks

### Task: Update a Page's Meta Description
1. Go to `seo.md` → find the page section
2. Copy the "Meta Description" text
3. Update `<meta name="description" content="...">` in the HTML file
4. Update `<meta property="og:description" content="...">` (Open Graph)
5. Update `<meta name="twitter:description" content="...">` (Twitter Card)
6. Commit with reference to the page name and WRK ticket

### Task: Update Schema.org Structured Data
1. Read `seo-optimization.md` → "Structured Data Keywords" section
2. Review the required JSON-LD schema for your page type
3. Update the `<script type="application/ld+json">` block in the HTML
4. Validate using [Schema.org Validator](https://validator.schema.org/)
5. Commit with schema type and page name

### Task: Add a New Page to SEO Coverage
1. Create the HTML page
2. Add entry to `seo.md` with:
   - Page URL
   - Title tag
   - Meta description
   - Key terms targeted
   - Schema markup needed
3. Update `seo-optimization.md` with new page details
4. Update sitemap.xml with new page URL and priority
5. Commit as a single SEO feature

### Task: Update Copy to Match seo.md
1. Find the page in `seo.md`
2. Note the exact copy for headlines, subheadings, key messages
3. Update the corresponding HTML elements
4. Ensure brand names match capitalization rules
5. Commit with page name and WRK ticket reference

---

## AI Agent Instructions

**When an AI agent is tasked with SEO updates:**

1. **Always check seo.md first** for canonical copy and messaging
2. **Never invent marketing copy** — use what's in seo.md
3. **Follow brand naming rules:** Finperiti (capitalized) vs finperiti (lowercase)
4. **Reference seo-optimization.md** for technical implementation details
5. **Validate changes** against both documents before committing
6. **Commit with ticket reference** (e.g., WRK-21, MRK-20)
7. **Document what you updated** in the commit message

---

## When to Update These Documents

### Update seo.md When:
- Marketing team approves new company positioning
- Product messaging changes
- Pricing or service areas change
- New customer testimonials are available
- Regulatory messaging needs updating
- Seasonal or campaign-specific copy is needed

**Process:** Marketing proposes → Product/Leadership approves → Developer implements from seo.md

### Update seo-optimization.md When:
- New SEO technical implementations are added
- Schema.org markup changes
- New pages are added to the site
- Robots.txt or sitemap.xml changes
- Brand naming guidelines change

**Process:** Document what was implemented with exact file locations and specs

---

## Quick Reference

| Need | Document | Section |
|------|----------|---------|
| Copy for homepage | seo.md | Home Page |
| Copy for about page | seo.md | About Page |
| Copy for pricing | seo.md | Pricing Page |
| Keywords to target | seo.md | Keyword Strategy |
| Brand naming rules | seo.md | Brand Name Capitalization |
| What was implemented | seo-optimization.md | What We Implemented |
| Schema.org specs | seo-optimization.md | Structured Data Keywords |
| Page URLs and priorities | seo-optimization.md | Pages Updated |
| Files created | seo-optimization.md | Files Created |

---

**Last Updated:** July 14, 2026  
**Owner:** Development Team / AI Agents  
**Related:** WRK-21 (SEO Optimization)
