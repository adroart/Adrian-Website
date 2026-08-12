# Collector open questions — research

> Answers to the two research items named in `HANDOFF-COLLECTOR.md` under "What is still
> open." Recommendation only; no wording or code changed. Adrian decides.

---

## 1. Garden-question timing — what the birthday moment actually is

**The question, as the handoff states it:** which garden questions wait for the birthday
and which stay open all year, and what the birthday moment itself is (a rewrite, a
check-in, an amendment, or an addition). Constraint: *"You don't want to be hit with ten
questions on your birthday."*

**What I found.** The closest real-world precedent is the "birthday interview" ritual
(a fixed set of reflection questions revisited every birthday, answers accreting into a
personal archive over years). Its own instructions read: "Choose the questions that
resonate most with you. There's no pressure to answer them all." Forty questions exist;
nobody is asked to face forty on the day. The design principle behind tying reflection to
a birthday at all, across every source I found, is the same one: a birthday works as an
*intentional pause*, a threshold that makes an answer feel dated and meant, not as a
deadline that produces a checklist.

**Recommendation: the garden stays open all year, with no deadline on anything. The
birthday touches almost nothing.**

- **Everything in the garden is answerable any day, forever**, exactly as already settled
  ("fill one now, five next month, the rest over years"). Nothing about that changes.
- **The birthday moment has exactly two jobs, never a queue:**
  1. **The dream** — already locked to a once-a-year unlock. This is the one true
     "birthday question," and it already exists. Nothing new needed here.
  2. **One quiet door, not a list** — the piece surfaces a single line near the birthday
     ("something for this year") that opens the garden already-open, pre-scrolled to
     whichever one or two questions have gone longest unanswered or unrevisited. It is an
     invitation into the same always-open garden, not a separate form and not a batch of
     new questions.
- **No question is ever "due."** A question answered three years ago and never touched
  again is not flagged, counted, or queued for a rewrite. If the caretaker opens it, they
  can add to or replace what is there; if they never open it again, the original answer
  simply stands, exactly like the dream's fallback to whatever was last placed.
- **This resolves the "mechanic still open" note** in `collector-screen-wording.md`
  (the lock on a placed answer) as: **an amendment, always optional, never a rewrite
  requirement, and never more than one surfaced at a time.** The plural "questions" framing
  in the handoff's own wording ("ten questions on your birthday") is the failure mode to
  design against directly — one door, at most one suggested question behind it.

This keeps the yearly ritual screen (`ritual` / `ritualfamily` in `collector-primitives.html`)
exactly as built — one dream field, family words arriving at their own windows — and adds
nothing to it. The birthday stays a pause, not a form.

**Sources**
- [The Birthday Interview Ritual That Gets Better With Age](https://thewellbeingcollective.com/blog/the-birthday-interview) — forty questions, answer only what resonates, birthday as threshold not deadline.
- [Personal Growth and Reflection: Birthday Celebrations](https://blog.hypnotechs.com/posts/happy-birthday) — birthday as a personal reflection point, general pattern.

---

## 2. Video capsule cost — what a solo artist can underwrite

**The question:** storage per short recording, per-piece economics across years, what is
realistic to promise without ever using the word "forever" for hosting.

**What I found, current 2026 Cloudflare pricing:**

- **Cloudflare Stream** (adaptive playback, thumbnails, built-in player): storage $5 per
  1,000 stored minutes per month ($0.005/minute-month); delivery $1 per 1,000 delivered
  minutes ($0.001/minute watched). Ingress and encoding are free. Delivery is the dominant
  line item at scale, but capsule videos are watched rarely, not streamed like content.
- **Cloudflare R2** (plain object storage, no adaptive streaming): $0.015/GB-month,
  **egress always $0**, a permanent free tier of 10GB + 1M/10M operations a month. A
  60-90 second 1080p video is roughly 15-40MB, so storage cost per video is a fraction of
  a cent per month.

**What this means at Adrian's actual scale** (hundreds of pieces, one to a handful of
short capsules per piece over decades, watched occasionally by family, not streamed
publicly):

- A single 60-second capsule stored on R2 costs roughly **$0.0003-0.0006/month**, i.e.
  well under a cent a year, with zero charge for family re-watching it.
- Even the richer Stream product, storing one minute for fifty years, costs about **$3
  total** over that piece's lifetime in storage, plus a fraction of a cent per view in
  delivery. Across hundreds of pieces this is real but small: on the order of a few
  hundred dollars a year at full adoption, not a few dollars.
- The free tier alone (10GB) covers roughly 250-600 short capsule videos before any
  storage bill starts.

**Recommendation: the capsule is affordable to promise, with two guardrails that make the
economics durable rather than optimistic:**

1. **R2, not Stream, as the default store.** No adaptive streaming or transcoding is
   needed for a short personal video watched by a handful of people; R2's egress-free
   model is the cheaper and simpler fit. Reach for Stream only if playback quality or
   thumbnails become a real complaint.
2. **Cap the length and count per piece** (for example, 90 seconds, and a small fixed
   number of capsules per piece rather than unlimited). This is what keeps the promise
   proportional as the collector base grows, and it is the natural companion to the
   wording rule already decided: never "forever" for hosting, always "exported and held."

This clears the deferral named in the handoff: the video capsule can be worded and
scheduled into "Record a video" and the yearly ritual now, with the R2-plus-cap shape as
the underwriting model, subject to Adrian confirming the length/count caps.

**Sources**
- [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing) / [Stream pricing breakdown](https://blog.blazingcdn.com/en-us/cloudflares-pricing-for-video-streaming-services) — $5/1,000 stored minutes, $1/1,000 delivered minutes, no egress fees.
- [Cloudflare R2 — Egress-Free Object Storage](https://www.cloudflare.com/products/r2/) / [R2 pricing 2026 breakdown](https://egresscost.com/cloudflare/) — $0.015/GB-month, $0 egress, 10GB free tier.
