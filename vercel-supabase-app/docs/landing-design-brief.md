# realloop.in landing page · design brief

Paste this into Claude Design. It says what the page has to do and what is true.
It deliberately does not say what sections to build or how to lay them out.

---

## The company

RealLoop gives AI companies on-demand access to credible human judgment.

Every company deploying AI hits the same wall in production: at some point you
need a human, either to judge whether the AI is actually good, to teach it what
good looks like, or to do what it still cannot. The ways teams solve this today
all fail in the same place. Internal bandwidth works at low volume and stops
scaling. Hiring a quality workforce is slow and hard. And even once hired,
making ordinary people fast and accurate at judgment work is its own problem.

RealLoop is two things:

- **A marketplace** of reviewers from India's workforce, vetted for judgment
  work and screened again for the specific task they are matched to.
- **An engine** that builds the workflow around them. It breaks a task into
  sub-tasks an ordinary reviewer can execute, trains reviewers on those exact
  sub-tasks, and generates the logging interface that makes their output fast
  and accurate.

The company's own one-line description is **"marketplace for credible human
judgment."** The vision is to be the human layer that every AI system in
production plugs into when it needs a real human to close the loop.

The central insight, and the thing the page should leave a reader with: the
common belief is that nobody delivers quality and scale together. Agencies
scale headcount but cannot hold quality. LLM judges scale infinitely but their
output cannot be trusted. RealLoop's claim is that delivering both is a
**workflow design problem, not a hiring problem** · break judgment into
objective sub-tasks an ordinary reviewer can do accurately, then screen and
train against those exact sub-tasks. That is what makes quality affordable, and
affordable quality is what makes the market servable.

Competitors, for positioning (do not name them on the page unless it earns its
place): staffing agencies give you bodies and nothing else. Observability and
auto-eval companies give coverage; RealLoop calibrates their LLM judges so the
scores can be trusted, and covers what an LLM cannot judge at all. Mercor and
Scale serve model builders and a few top-tier enterprises with elite experts at
elite prices; nobody serves the far larger number of AI *application* companies
below that line who need skilled but affordable judgment.

Voice AI is the current proof, not the definition. The first working version of
the engine is the voice-AI evaluation one. A browser co-pilot pilot is the
first text use case. The page must not read as a voice-QA company.

---

## What this page has to do

Two audiences arrive here and they want opposite things. The page has to serve
both without either feeling like an afterthought, and without the reader having
to work out which half is theirs.

**An AI company** with something in production that is not good enough, who
needs humans on it and does not want to hire a team. They should leave
understanding that they can describe their problem in plain language and have a
screened, trained panel running on it in days, with the quality of that panel
measured and published back to them.

**A prospective reviewer** in India, often tier-2, who wants real paid remote
work. They should leave understanding that this is skilled judgment work rather
than data entry, that they will be trained and screened rather than thrown at a
queue, that it is phone-first, and that getting in is a short task they can do
now rather than a CV they post into a void.

Both audiences currently get one email address. That is the biggest failure of
the existing page.

### The two calls to action

Everything else on the page is in service of these.

- **"Become a reviewer"** → `https://marketplace.realloop.in`
  Goes to a real screening flow: pick your languages, then do an actual
  assignment on real production call audio. Mobile-first, works on a phone.
- **"Put humans on it"** → `https://portal.realloop.in/portal/new-use-case`
  Goes to a screen that asks "Where do you need human help with your AI agent?"
  The client writes three or four sentences in plain language, and the product
  reads it back with the checks it would run, why it picked each one quoting
  the client's own words, what is human versus machine-judged, the volume, and
  a price. Nothing is created until they choose to start.

The enterprise CTA wording is a decision, not a placeholder. It is a verb, it
matches the destination's own first question, and it avoids "hire us", which
would frame RealLoop as an agency · the exact thing the positioning rejects.
If a second, softer entry point is wanted for people not ready to type into a
box, "See what we found" is available; it can go to the same destination.

---

## What is true, and what is not

Use only what is here. Everything below is real unless flagged.

**Traction.** Three pilots, all expected to convert to recurring contracts in
Aug/Sep 2026. Bolna (YC F25, voice AI orchestration) · four-week pilot closed.
A Series A consumer fintech, voice and human collections calls. Merlin by Foyer
(Series A browser co-pilot) · the first text use case. **No revenue yet**; the
contracts are expected, not signed. Do not imply otherwise. Do not put a
customer logo wall on the page.

**Naming clients publicly needs their permission.** Bolna is the safest to name
and even then confirm first. Treat the other two as "a Series A consumer
fintech" and "a Series A browser co-pilot" unless told otherwise.

**Scale.** 10 full-time reviewers onboarded through the screening tool, on
track for 50 as pilot volumes grow. Around 200 hours of production calls
reviewed. Around 200 hours of transcription data created. Hindi and Hinglish
production calls today.

**The founders.** Two, both full-time since mid-June 2026, working in person in
Bengaluru, from Meesho. The origin story is usable and it is the real reason
this company exists: at Meesho one founder built an LLM system to club variant
SKUs, an LLM judge on top could not hit the accuracy bar, and the catalog was
too long-tail to write a rulebook for · so she broke the judgment into
objective checks an ops reviewer could make. That is the whole thesis in one
anecdote. The other founder built Meesho's quality-ranking layer and writes all
of RealLoop's code. Both have run 10+ person ops teams.

There is a second thread worth its weight if it fits: the ops workforce that
closed those loops at Meesho was largely tier-2 India, the same "next billion"
Meesho set out to serve. The founders' view is that the next billion's next
chapter is doing this work for AI deployments everywhere.

**Reliability numbers · read this carefully.** The product measures how much
its own panel can be trusted: how often reviewers agree with each other, and
how often they match a hidden expert on the same calls. That measurement, and
the fact that it is published to clients, is a genuine differentiator and
belongs on this page as a *claim*. But the specific figures shown inside the
product demo are polished demo values, not today's measured ones. **Do not put
a reliability percentage on the public page until the real current number is
confirmed.** Write it so a number can be dropped in later, or state the
capability without a figure. A wrong number here is a public claim, which is a
different thing from a demo.

Same rule for anything else numeric that is not in this brief: leave a slot,
do not invent.

---

## Constraints

**Where it lives.** `vercel-supabase-app/public/apex.html`, served for
realloop.in and www via middleware rewrite. It must be a **single
self-contained HTML file** · inline CSS and JS, no local asset files, no build
step. Web fonts via CDN are fine; that is how the current page works.

**Responsive, genuinely.** A large share of reviewer traffic is on a phone,
often a cheap one on a slow connection. The reviewer path in particular must be
excellent on mobile. Keep the page light.

**Typography and colour.** The product uses Space Grotesk for headings,
Instrument Sans for body, IBM Plex Mono for data. Ink `#10181f`, muted
`#6b7885`, lines `#e2e8ee`, background `#f5f7f9`, green `#0e8a5f`. Inside the
product, **green means a human did it and purple `#7c5cbf` means a machine
judged it** · that distinction is load-bearing and if the page uses the two
colours it must respect it. The landing does not have to look identical to the
product, but a client who clicks through should not feel they changed company.

**No em dashes or en dashes anywhere.** Use a middot (·) or a plain hyphen.
This is a hard house rule across every surface.

**Copyright line is stale** on the current page (2025). It is 2026.

**Tone.** Plain, concrete, unhurried. The product's own voice is the reference:
"Write it the way you would explain it to someone joining your team on Monday.
No metrics, no rubric · that is our job." No enterprise filler, no "leverage",
no "revolutionise", no hero image of a robot. Specific beats grand · the
strongest thing this company can say is a real example of a transcript saying
one thing and the customer having said another.

---

## What is wrong with the page today

For reference, so it is not reproduced. The current page calls RealLoop "AI
Voice Quality Assurance" and describes a services agency that "embeds trained
reviewers into client pipelines on a project basis". That is narrower than what
the company is and frames it as the exact competitor category it is trying not
to be. It has no enterprise entry point at all, sends reviewers to an email
address instead of the screening flow, and its four-step "how we work" section
describes a consulting engagement rather than a product.
