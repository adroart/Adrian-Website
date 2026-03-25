import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { img } from '../utils/cloudinary';

type CommissionType = 'personal' | 'spatial';
type SendStatus = 'IDLE' | 'SENDING' | 'ERROR';

interface FormState {
  name: string;
  email: string;
  vision: string;
  commissionType: CommissionType;
  budget: string;
  location: string;
  sizeRange: string;
  timeline: string;
  specificDate: string;
  referral: string;
  referralOther: string;
}

/* ── Budget range slider ───────────────────────────────────────────── */
const BUDGET_STOPS = [500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 9000, 10000, 15000, 25000, 50000, 75000, 100000];

const formatBudget = (val: number): string => {
  if (val >= 100000) return '$100,000+';
  return '$' + val.toLocaleString();
};

const TIMELINE_OPTIONS: { label: string; value: string }[] = [
  { label: 'flexible', value: 'Flexible / No rush' },
  { label: 'within 3 months', value: 'Within 3 months' },
  { label: 'within 6 months', value: 'Within 6 months' },
  { label: 'within a year', value: 'Within a year' },
  { label: 'tied to a specific date', value: 'Specific date' },
];

const REFERRAL_OPTIONS: { label: string; value: string }[] = [
  { label: 'word of mouth', value: 'Word of mouth' },
  { label: 'Instagram', value: 'Instagram' },
  { label: 'seeing a piece in person', value: 'Saw a piece in person' },
  { label: 'your writings', value: 'Writings / Blog' },
  { label: 'Burning Man or a festival', value: 'Burning Man or festival' },
  { label: 'somewhere else', value: 'Other' },
];

const COMMISSION_PATHS = {
  personal: {
    label: 'Personal',
    title: 'Personal Commissions',
    description:
      'Something for your home, your altar, your life. A centerpiece. An alternative to passive consumption. A place to sit with. To feel held. To feel connected. Created from conversation about what wants to exist.',
    image: img('adrian-website/placeholders/artwork-square-3', { w: 1000, h: 1200 }),
    alt: 'Personal commission piece by Adrian Rasmussen',
    successMsg: 'Your vision for a personal piece is on its way to Bali.',
    suggestLink: '/creations',
    suggestLabel: 'Explore the Creations',
  },
  spatial: {
    label: 'Spatial',
    title: 'Spatial Commissions',
    description:
      'When you walk into a space, there is something you can feel. I love creating spaces that bring this through. Installations. Tea houses. Stages. The art, the ceremony, the intention. All in service of what happens between people when presence is held.',
    image: img('adrian-website/placeholders/hero-wide-3', { w: 1200, h: 1000 }),
    alt: 'Spatial installation by Adrian Rasmussen',
    successMsg: 'Your spatial vision is on its way to Bali.',
    suggestLink: '/creations/multidimensional-art',
    suggestLabel: 'See Spatial Installations',
  },
} as const;

const EXPECT_STEPS = [
  { label: 'You inquire', sub: 'Right now' },
  { label: 'We talk', sub: 'Within days' },
  { label: 'Creation begins', sub: 'When it\'s right' },
];

/* ── Scroll-reveal hook ─────────────────────────────────────────────── */
function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay) {
            setTimeout(() => setVisible(true), delay);
          } else {
            setVisible(true);
          }
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  const cls = `transition-all duration-700 ease-out ${
    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
  }`;

  return { ref, cls };
}

/* ══════════════════════════════════════════════════════════════════════ */

const Inquire: React.FC = () => {
  const [commissionType, setCommissionType] = useState<CommissionType>('personal');
  const [submitted, setSubmitted] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState<Record<string, boolean>>({});
  // coreSubmitted state removed — #34
  const [budgetRange, setBudgetRange] = useState<[number, number]>([0, BUDGET_STOPS.length - 1]);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    vision: '',
    commissionType: 'personal',
    budget: '',
    location: '',
    sizeRange: '',
    timeline: '',
    specificDate: '',
    referral: '',
    referralOther: '',
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const visionRef = useRef<HTMLTextAreaElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Pre-fill vision from router state (e.g. "Inquire about a similar piece" from PiecePage)
  const location = useLocation();
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    const piece = (location.state as { piece?: string } | null)?.piece;
    if (piece) {
      const prefill = `I'm interested in a piece similar to "${piece}".`;
      setForm(prev => ({ ...prev, vision: prefill }));
      setPrefilled(true);
      // Auto-grow textarea after pre-fill
      requestAnimationFrame(() => {
        if (visionRef.current) {
          visionRef.current.style.height = 'auto';
          visionRef.current.style.height = visionRef.current.scrollHeight + 'px';
        }
      });
    }
  }, [location.state]);

  // Clear prefilled flag once user edits the vision field
  const handleVisionFocus = () => {
    if (prefilled) setPrefilled(false);
  };

  // Scroll reveals for each section
  const cardsReveal = useReveal();
  const testimonialReveal = useReveal(150);
  const formReveal = useReveal();
  const timelineReveal = useReveal(100);
  const faqReveal = useReveal();

  /* ── Parallax hero ────────────────────────────────────────────────── */
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const handleScroll = () => {
      hero.style.transform = `translateY(${window.scrollY * 0.3}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── Navigation warning when form is dirty ──────────────────────── */
  // Exclude the pre-filled vision text from the dirty check so navigating
  // back without typing doesn't trigger a "leave page?" warning
  const visionIsDirty = form.vision !== '' && !prefilled;
  const isDirty = !submitted && (
    form.name !== '' || form.email !== '' || visionIsDirty ||
    form.location !== '' || form.sizeRange !== '' || form.timeline !== '' || form.referral !== ''
  );

  // Browser-level warning (refresh, close tab, external link)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

/* ── Budget range → form.budget sync ────────────────────────────── */
  useEffect(() => {
    const low = BUDGET_STOPS[budgetRange[0]];
    const high = BUDGET_STOPS[budgetRange[1]];
    if (budgetRange[0] === 0 && budgetRange[1] === BUDGET_STOPS.length - 1) {
      setForm(prev => ({ ...prev, budget: '' }));
    } else if (budgetRange[0] === budgetRange[1]) {
      setForm(prev => ({ ...prev, budget: `Around ${formatBudget(low)}` }));
    } else {
      setForm(prev => ({ ...prev, budget: `${formatBudget(low)} to ${formatBudget(high)}` }));
    }
  }, [budgetRange]);

  /* ── Form helpers ─────────────────────────────────────────────────── */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /* Auto-grow textarea */
  const handleVisionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
    const el = visionRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  };

  /* Inline validation */
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null;
    const value = form[field as keyof FormState];
    if (field === 'name' && !value.trim()) return 'Please enter your name';
    if (field === 'email' && !value.trim()) return 'Please enter your email';
    if (field === 'email' && !isValidEmail(value)) return 'Please enter a valid email';
    if (field === 'vision' && !value.trim()) return 'Please share your vision';
    return null;
  };

  const handleFocus = (field: string) => {
    setFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFocused(prev => ({ ...prev, [field]: false }));
  };

  /* Enter key advances to next field */
  const handleKeyDown = (field: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = form[field as keyof FormState];
      if (field === 'name' && value.trim()) emailRef.current?.focus();
      if (field === 'email' && value.trim() && isValidEmail(value)) visionRef.current?.focus();
    }
  };

  const fieldBorderClass = (field: string) => {
    const error = getFieldError(field);
    if (error) return 'border-wood-500';
    if (touched[field] && form[field as keyof FormState].trim() && (field !== 'email' || isValidEmail(form.email)))
      return 'border-bronze-400';
    return 'border-wood-300 focus:border-bronze-500';
  };

  /* Floating label class */
  const floatLabel = (field: string) => {
    const isUp = focused[field] || form[field as keyof FormState]?.trim();
    return `absolute left-0 pointer-events-none font-label uppercase tracking-[0.2em] font-semibold transition-all duration-200 ${
      isUp
        ? 'top-0 text-[10px] text-wood-500'
        : 'top-5 text-xs text-wood-400'
    }`;
  };

  const handleCommissionType = (type: CommissionType) => {
    setCommissionType(type);
    setForm(prev => ({ ...prev, commissionType: type }));
  };

  /* Select card & scroll to form */
  const selectAndScroll = (type: CommissionType) => {
    handleCommissionType(type);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  /* Pill toggle */
  const handlePillSelect = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: prev[field] === value ? '' : value }));
  };

  /* #34 — Removed silent early submit. Data is only sent when the user explicitly submits. */

  /* Form completion progress */
  const completionCount = [
    form.name.trim(),
    form.email.trim() && isValidEmail(form.email),
    form.vision.trim(),
    form.budget,
    form.location.trim(),
    form.sizeRange.trim(),
    form.timeline,
    form.referral,
  ].filter(Boolean).length;
  const completionPercent = Math.round((completionCount / 8) * 100);

  /* Vision word count */
  const wordCount = form.vision.trim() ? form.vision.trim().split(/\s+/).length : 0;

  /* All required fields are filled and valid */
  const requiredValid = !!(form.name.trim() && form.email.trim() && isValidEmail(form.email) && form.vision.trim());

  /* ── Submit ───────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Touch all required fields to show validation
    setTouched(prev => ({ ...prev, name: true, email: true, vision: true }));
    if (!requiredValid) return;

    setSendStatus('SENDING');
    setErrorMsg('');

    try {
      const res = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
        setSendStatus('IDLE');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Submission failed.');
      }
    } catch (err: any) {
      setSendStatus('ERROR');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSendStatus('IDLE');
    setErrorMsg('');
    setForm({ name: '', email: '', vision: '', commissionType: 'personal', budget: '', location: '', sizeRange: '', timeline: '', specificDate: '', referral: '', referralOther: '' });
    setImageFiles([]);
    setBudgetRange([0, BUDGET_STOPS.length - 1]);
    setCommissionType('personal');
    setTouched({});
    setFocused({});
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  const chosenPath = COMMISSION_PATHS[commissionType];

  return (
    <section className="bg-paper-50 min-h-screen animate-fade-in">

      {/* ── Hero Image with overlaid title ─────────────────────────── */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <div ref={heroRef} className="absolute inset-0 will-change-transform">
          <img
            src={img('adrian-website/placeholders/hero-wide-2', { w: 1600, h: 900 })}
            alt="Adrian Rasmussen's studio"
            className="w-full h-[120%] object-cover brightness-[0.55] saturate-[0.15] contrast-[1.1] sepia-[0.15]"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.5)_0%,transparent_70%)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-paper-50/70 mb-4 font-semibold" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
            Commissions &amp; Collaborations
          </p>
          <h1 className="font-title text-5xl sm:text-6xl md:text-7xl text-paper-50 font-light tracking-wide" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            Inquire
          </h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-paper-50 to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-16 pb-20">

        {/* Opening text — pull-quote style */}
        <div className="mb-20 max-w-3xl mx-auto text-center">
          <p className="font-serif text-2xl md:text-3xl text-wood-700 leading-[1.6] font-light mb-8">
            I take on a small number of commissions each year. Some become
            intimate pieces for personal spaces. Others become installations
            that transform environments.
          </p>
          <span className="block w-12 h-px bg-bronze-400/60 mx-auto mb-8" />
          <p className="font-serif text-lg text-wood-500 leading-[1.7] italic mb-3">
            I am selective. Not every project is the right project.
            The right ones find me, and I recognize them when they do.
          </p>
          <p className="font-serif text-lg text-wood-600 leading-[1.7]">
            If you are feeling a pull toward working together, trust that.
          </p>
        </div>

        {/* ── Commission Path Cards (scroll-reveal) ─────────────────── */}
        <div ref={cardsReveal.ref} className={cardsReveal.cls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {(Object.keys(COMMISSION_PATHS) as CommissionType[]).map((type) => {
              const path = COMMISSION_PATHS[type];
              const isSelected = commissionType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => selectAndScroll(type)}
                  className={`group text-left border flex flex-col overflow-hidden transition-all duration-500 ${
                    isSelected
                      ? 'border-wood-900 ring-1 ring-wood-900 scale-[1.01]'
                      : 'border-wood-200 hover:border-wood-400 scale-[0.98] opacity-70 hover:opacity-90'
                  }`}
                >
                  <div className="relative h-[260px] sm:h-[300px] md:h-[340px] overflow-hidden bg-wood-100">
                    <img
                      src={path.image}
                      className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                        isSelected
                          ? 'grayscale-0 scale-[1.02]'
                          : 'grayscale scale-100 group-hover:grayscale-[50%] group-hover:scale-[1.01]'
                      }`}
                      alt={path.alt}
                      loading="lazy"
                    />
                    <div
                      className={`absolute inset-0 bg-wood-900 transition-opacity duration-500 ${
                        isSelected ? 'opacity-0' : 'opacity-10'
                      }`}
                    />
                    <div className="absolute top-4 left-4 bg-paper-50/90 px-3 py-1.5 font-label text-[11px] uppercase tracking-[0.2em] font-semibold">
                      {path.label}
                    </div>
                  </div>
                  <div className="p-6 md:p-8 flex flex-col flex-1 bg-white">
                    <h3 className="font-title text-xl tracking-[0.08em] text-wood-900 mb-3">
                      {path.title}
                    </h3>
                    <p
                      className={`font-serif text-wood-600 leading-[1.7] mb-6 flex-1 text-base transition-all duration-500 overflow-hidden ${
                        isSelected ? 'max-h-40 opacity-100' : 'max-h-20 opacity-60'
                      }`}
                    >
                      {path.description}
                    </p>
                    <span
                      className={`font-label text-xs uppercase tracking-[0.2em] font-semibold self-start flex items-center gap-2 transition-all duration-300 ${
                        isSelected ? 'text-bronze-600' : 'text-wood-500 group-hover:text-wood-900'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select this path'}
                      <ArrowRight
                        size={12}
                        className={`transition-transform duration-300 ${
                          isSelected ? 'translate-x-0' : 'group-hover:translate-x-1'
                        }`}
                      />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── General Contact ──────────────────────────────────────── */}
        <div className="flex justify-center mb-6">
          <a
            href="mailto:hello@adrianrasmussen.com"
            className="group inline-flex items-center gap-3 px-8 py-4 transition-all duration-300"
          >
            <span className="font-serif text-base text-wood-400 group-hover:text-wood-600 italic transition-colors">
              Just want to say hello?
            </span>
            <span className="w-6 h-px bg-wood-300 group-hover:bg-bronze-400 group-hover:w-8 transition-all duration-300" />
            <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-500 font-semibold group-hover:text-bronze-700 transition-colors">
              Email
            </span>
          </a>
        </div>

        {/* ── Testimonial (scroll-reveal) ───────────────────────────── */}
        <div ref={testimonialReveal.ref} className={testimonialReveal.cls}>
          <div className="max-w-2xl mx-auto text-center py-12 mb-8">
            <span className="block font-serif text-4xl text-bronze-400/40 mb-4 leading-none">"</span>
            <blockquote className="font-serif text-xl md:text-2xl text-wood-500 italic leading-[1.7] font-light">
              Previous commissions have included oracle deck illustrations,
              hand-carved furniture, festival stage designs, and
              illuminated altar pieces.
            </blockquote>
            <span className="block w-8 h-px bg-wood-200 mx-auto mt-6 mb-4" />
            <p className="font-label text-[10px] uppercase tracking-[0.3em] text-wood-400 font-semibold">
              From the Studio
            </p>
          </div>
        </div>

        {/* ── Form (scroll-reveal) ──────────────────────────────────── */}
        <div ref={formReveal.ref} className={formReveal.cls}>
          <div ref={formRef} className="max-w-3xl mx-auto scroll-mt-28">

            {submitted ? (
              /* ── Rich Success State ──────────────────────────────── */
              <div className="bg-wood-50 border border-wood-100 p-8 md:p-16 text-center relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  }}
                />
                <div className="relative z-10">
                  <div className="w-16 h-16 mx-auto mb-8 rounded-full bg-bronze-100 flex items-center justify-center">
                    <CheckCircle className="text-bronze-600" size={32} strokeWidth={1.5} />
                  </div>
                  <h4 className="font-serif text-3xl text-wood-900 mb-4 font-medium">
                    The conversation has begun.
                  </h4>
                  <p className="font-serif text-xl text-wood-700 leading-[1.7] mb-2 font-light">
                    {chosenPath.successMsg}
                  </p>
                  <p className="font-serif text-wood-500 leading-[1.7] mb-10">
                    I'll be in touch within a few days.
                  </p>
                  <div className="border-t border-wood-200 pt-8 mb-8">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-4">
                      While you wait
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <a
                        href={chosenPath.suggestLink}
                        className="font-serif text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
                      >
                        {chosenPath.suggestLabel}
                      </a>
                      <span className="hidden sm:inline text-wood-300">&middot;</span>
                      <a
                        href="/writings"
                        className="font-serif text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
                      >
                        Read the Writings
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 border-b border-wood-300 pb-1 hover:text-wood-900 hover:border-wood-900 transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <fieldset disabled={sendStatus === 'SENDING'} className="disabled:opacity-60 disabled:pointer-events-none transition-opacity duration-300">

                {/* ── Form Completion Bar ────────────────────────── */}
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex-1 h-1 bg-wood-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-bronze-500 transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 font-semibold tabular-nums whitespace-nowrap">
                    {completionCount} of 8
                  </span>
                </div>

                <div className="bg-wood-50 p-8 md:p-14 lg:p-16 border border-wood-100 border-t-0">
                  <p className="font-serif text-2xl md:text-3xl text-wood-700 leading-[1.5] font-light mb-4">
                    Tell me what you are imagining.
                  </p>
                  <p className="font-serif text-base text-wood-400 leading-[1.7] mb-12 italic">
                    We will figure out the details together.
                  </p>

                  {/* Commission type indicator (set by card selection above) */}
                  <div className="mb-12 flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-wood-200 bg-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-bronze-500" />
                      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-700 font-semibold">
                        {COMMISSION_PATHS[commissionType].label} Commission
                      </span>
                    </span>
                  </div>

                  {/* ── Name + Email with Floating Labels ────────── */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-label text-[10px] text-wood-400 font-semibold tracking-[0.15em] uppercase">01</span>
                    <span className="flex-1 h-px bg-wood-100" />
                    <span className="font-label text-[10px] text-wood-400 tracking-[0.15em] uppercase">Your details</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 mb-10">
                    <div className="relative pt-4">
                      <input
                        ref={nameRef}
                        type="text"
                        name="name"
                        id="field-name"
                        value={form.name}
                        onChange={handleChange}
                        onFocus={() => handleFocus('name')}
                        onBlur={() => handleBlur('name')}
                        onKeyDown={(e) => handleKeyDown('name', e)}
                        autoComplete="name"
                        aria-describedby={getFieldError('name') ? 'name-error' : undefined}
                        className={`w-full bg-transparent border-b-2 pt-2 pb-3 outline-none font-serif text-lg transition-colors duration-300 ${fieldBorderClass('name')}`}
                        required
                      />
                      <label htmlFor="field-name" className={floatLabel('name')}>
                        Name
                      </label>
                      {touched.name && !getFieldError('name') && form.name.trim() && (
                        <Check size={14} className="absolute right-0 top-6 text-bronze-500 animate-fade-in" strokeWidth={2.5} />
                      )}
                      {getFieldError('name') && (
                        <p id="name-error" role="alert" className="font-serif text-sm text-wood-500 mt-1.5 animate-fade-in">
                          {getFieldError('name')}
                        </p>
                      )}
                    </div>
                    <div className="relative pt-4">
                      <input
                        ref={emailRef}
                        type="email"
                        name="email"
                        id="field-email"
                        value={form.email}
                        onChange={handleChange}
                        onFocus={() => handleFocus('email')}
                        onBlur={() => handleBlur('email')}
                        onKeyDown={(e) => handleKeyDown('email', e)}
                        autoComplete="email"
                        aria-describedby={getFieldError('email') ? 'email-error' : undefined}
                        className={`w-full bg-transparent border-b-2 pt-2 pb-3 outline-none font-serif text-lg transition-colors duration-300 ${fieldBorderClass('email')}`}
                        required
                      />
                      <label htmlFor="field-email" className={floatLabel('email')}>
                        Email
                      </label>
                      {touched.email && !getFieldError('email') && form.email.trim() && isValidEmail(form.email) && (
                        <Check size={14} className="absolute right-0 top-6 text-bronze-500 animate-fade-in" strokeWidth={2.5} />
                      )}
                      {getFieldError('email') && (
                        <p id="email-error" role="alert" className="font-serif text-sm text-wood-500 mt-1.5 animate-fade-in">
                          {getFieldError('email')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Vision with Auto-grow + Word Count ───────── */}
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-label text-[10px] text-wood-400 font-semibold tracking-[0.15em] uppercase">02</span>
                    <span className="flex-1 h-px bg-wood-100" />
                    <span className="font-label text-[10px] text-wood-400 tracking-[0.15em] uppercase">Your vision</span>
                  </div>
                  <div className="mb-12">
                    <label
                      htmlFor="field-vision"
                      className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-3"
                    >
                      What wants to exist?
                    </label>
                    <div className={`transition-all duration-300 ${focused.vision ? 'border-l-2 border-l-bronze-400 pl-4' : 'border-l-2 border-l-transparent pl-4'}`}>
                      <textarea
                        ref={visionRef}
                        name="vision"
                        id="field-vision"
                        rows={2}
                        value={form.vision}
                        onChange={handleVisionChange}
                        onFocus={() => { handleFocus('vision'); handleVisionFocus(); }}
                        onBlur={() => handleBlur('vision')}
                        aria-describedby={getFieldError('vision') ? 'vision-error' : undefined}
                        className={`w-full bg-transparent border-b-2 pt-2 pb-3 outline-none font-serif text-lg resize-none overflow-hidden transition-colors duration-300 leading-relaxed ${fieldBorderClass('vision')}`}
                        placeholder="A piece for my meditation space, something that holds stillness..."
                        required
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 pl-4">
                      {getFieldError('vision') ? (
                        <p id="vision-error" role="alert" className="font-serif text-sm text-wood-500 animate-fade-in">
                          {getFieldError('vision')}
                        </p>
                      ) : (
                        <span />
                      )}
                      {wordCount > 0 && (
                        <p className="font-label text-[10px] text-wood-400 transition-opacity duration-300">
                          {wordCount} {wordCount === 1 ? 'word' : 'words'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Optional Fields (progressive disclosure) ── */}
                  <div className={`form-reveal ${requiredValid ? 'is-open' : ''}`}>
                    <div className="form-reveal-inner">
                      {/* Divider */}
                      <div className="border-t border-wood-200 pt-10 mb-10">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-label text-[10px] text-wood-400 font-semibold tracking-[0.15em] uppercase">03</span>
                          <span className="flex-1 h-px bg-wood-100" />
                          <span className="font-label text-[10px] text-bronze-500 tracking-[0.15em] uppercase">Optional</span>
                        </div>
                        <p className="font-serif text-sm text-wood-400">
                          Helps me prepare for our conversation.
                        </p>
                      </div>

                      <div className="space-y-10 mb-12">
                        {/* Budget Range Slider */}
                        <div>
                          <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-2">
                            Budget Range
                          </label>
                          <p className="font-serif text-base text-wood-700 mb-5 min-h-[1.5em]">
                            {budgetRange[0] === 0 && budgetRange[1] === BUDGET_STOPS.length - 1
                              ? 'Drag to set your range'
                              : budgetRange[0] === budgetRange[1]
                                ? `Around ${formatBudget(BUDGET_STOPS[budgetRange[0]])}`
                                : `${formatBudget(BUDGET_STOPS[budgetRange[0]])} to ${formatBudget(BUDGET_STOPS[budgetRange[1]])}`}
                          </p>
                          <div className="relative h-10 flex items-center">
                            {/* Track */}
                            <div className="absolute inset-x-0 h-1 bg-wood-200 rounded-full" />
                            {/* Active range */}
                            <div
                              className="absolute h-1 bg-bronze-400 rounded-full transition-all duration-150"
                              style={{
                                left: `${(budgetRange[0] / (BUDGET_STOPS.length - 1)) * 100}%`,
                                width: `${((budgetRange[1] - budgetRange[0]) / (BUDGET_STOPS.length - 1)) * 100}%`,
                              }}
                            />
                            {/* Low thumb */}
                            <input
                              type="range"
                              min={0}
                              max={BUDGET_STOPS.length - 1}
                              value={budgetRange[0]}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val <= budgetRange[1]) setBudgetRange([val, budgetRange[1]]);
                              }}
                              className="budget-slider absolute left-0 w-full"
                              aria-label="Minimum budget"
                              aria-valuetext={formatBudget(BUDGET_STOPS[budgetRange[0]])}
                            />
                            {/* High thumb */}
                            <input
                              type="range"
                              min={0}
                              max={BUDGET_STOPS.length - 1}
                              value={budgetRange[1]}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val >= budgetRange[0]) setBudgetRange([budgetRange[0], val]);
                              }}
                              className="budget-slider absolute left-0 w-full"
                              aria-label="Maximum budget"
                              aria-valuetext={formatBudget(BUDGET_STOPS[budgetRange[1]])}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="font-label text-[10px] text-wood-400">{formatBudget(BUDGET_STOPS[0])}</span>
                            <span className="font-label text-[10px] text-wood-400">{formatBudget(BUDGET_STOPS[BUDGET_STOPS.length - 1])}</span>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="relative pt-5">
                          <label className={floatLabel('location')}>Location</label>
                          <input
                            type="text"
                            name="location"
                            value={form.location}
                            onChange={handleChange}
                            onFocus={() => handleFocus('location')}
                            onBlur={() => handleBlur('location')}
                            className="w-full border-b border-wood-300 focus:border-bronze-500 bg-transparent py-2 font-serif text-lg text-wood-900 outline-none transition-colors"
                            placeholder=""
                          />
                          <p className="font-serif text-xs text-wood-400 mt-1.5">City, country, or region where the piece will live.</p>
                        </div>

                        {/* Approximate Size Range */}
                        <div className="relative pt-5">
                          <label className={floatLabel('sizeRange')}>Approximate Size</label>
                          <input
                            type="text"
                            name="sizeRange"
                            value={form.sizeRange}
                            onChange={handleChange}
                            onFocus={() => handleFocus('sizeRange')}
                            onBlur={() => handleBlur('sizeRange')}
                            className="w-full border-b border-wood-300 focus:border-bronze-500 bg-transparent py-2 font-serif text-lg text-wood-900 outline-none transition-colors"
                            placeholder=""
                          />
                          <p className="font-serif text-xs text-wood-400 mt-1.5">Wall space, table dimensions, or a general sense of scale.</p>
                        </div>

                        {/* Image Upload */}
                        <div>
                          <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-2">
                            Inspiration Images
                          </label>
                          <p className="font-serif text-xs text-wood-400 mb-3">Photos of the space, reference images, or anything that helps me understand your vision.</p>
                          <label className="flex items-center justify-center gap-2 py-4 border border-dashed border-wood-300 hover:border-bronze-400 bg-white cursor-pointer transition-colors">
                            <span className="font-label text-xs uppercase tracking-[0.15em] text-wood-500">
                              {imageFiles.length > 0 ? `${imageFiles.length} file${imageFiles.length > 1 ? 's' : ''} selected` : 'Choose files'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="sr-only"
                              onChange={(e) => {
                                if (e.target.files) setImageFiles(Array.from(e.target.files));
                              }}
                            />
                          </label>
                        </div>

                        {/* Timeline — vertical radio list */}
                        <div>
                          <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-4">
                            Timeline
                          </label>
                          <div className="space-y-0">
                            {TIMELINE_OPTIONS.map((opt) => {
                              const selected = form.timeline === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handlePillSelect('timeline', opt.value)}
                                  className={`w-full flex items-center gap-4 py-3.5 border-b border-wood-100 text-left transition-colors duration-200 cursor-pointer group ${
                                    selected ? '' : 'hover:bg-wood-50/50'
                                  }`}
                                >
                                  <span className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all duration-200 ${
                                    selected
                                      ? 'border-bronze-500 bg-bronze-500'
                                      : 'border-wood-300 bg-transparent group-hover:border-wood-400'
                                  }`} />
                                  <span className={`font-serif text-base transition-colors duration-200 ${
                                    selected ? 'text-wood-900' : 'text-wood-500 group-hover:text-wood-700'
                                  }`}>
                                    {opt.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {form.timeline === 'Specific date' && (
                            <div className="mt-4">
                              <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-2">
                                Target date
                              </label>
                              <input
                                type="date"
                                value={form.specificDate}
                                onChange={(e) => setForm(prev => ({ ...prev, specificDate: e.target.value }))}
                                className="w-full border-b border-wood-200 bg-transparent py-2 font-serif text-wood-900 outline-none focus:border-bronze-500 transition-colors"
                              />
                            </div>
                          )}
                        </div>

                        {/* Referral — vertical radio list */}
                        <div>
                          <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-4">
                            How did you find me?
                          </label>
                          <div className="space-y-0">
                            {REFERRAL_OPTIONS.map((opt) => {
                              const selected = form.referral === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handlePillSelect('referral', opt.value)}
                                  className={`w-full flex items-center gap-4 py-3.5 border-b border-wood-100 text-left transition-colors duration-200 cursor-pointer group ${
                                    selected ? '' : 'hover:bg-wood-50/50'
                                  }`}
                                >
                                  <span className={`w-3 h-3 rounded-full border-2 shrink-0 transition-all duration-200 ${
                                    selected
                                      ? 'border-bronze-500 bg-bronze-500'
                                      : 'border-wood-300 bg-transparent group-hover:border-wood-400'
                                  }`} />
                                  <span className={`font-serif text-base transition-colors duration-200 ${
                                    selected ? 'text-wood-900' : 'text-wood-500 group-hover:text-wood-700'
                                  }`}>
                                    {opt.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {form.referral === 'Other' && (
                            <div className="mt-4">
                              <input
                                type="text"
                                value={form.referralOther}
                                onChange={(e) => setForm(prev => ({ ...prev, referralOther: e.target.value }))}
                                placeholder="Please share how you found me..."
                                className="w-full border-b border-wood-200 bg-transparent py-2 font-serif text-wood-900 outline-none focus:border-bronze-500 transition-colors"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Error */}
                  {sendStatus === 'ERROR' && (
                    <div className="flex items-start gap-3 p-4 border border-wood-300 bg-white text-wood-700 mb-8">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-wood-500" />
                      <p className="font-serif text-sm">{errorMsg}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex justify-center pt-4">
                    <button
                      type="submit"
                      disabled={sendStatus === 'SENDING'}
                      className="w-full sm:w-auto flex items-center justify-center gap-3 px-14 py-5 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-wait"
                    >
                      {sendStatus === 'SENDING' ? (
                        <span className="animate-pulse">Sending...</span>
                      ) : (
                        <>Start the conversation <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                </div>
                </fieldset>
              </form>
            )}
          </div>
        </div>

        {/* ── "What to expect" micro-timeline (scroll-reveal) ───────── */}
        {!submitted && (
          <div ref={timelineReveal.ref} className={timelineReveal.cls}>
            <div className="mt-20 max-w-xl mx-auto border border-wood-100 bg-wood-50 px-8 py-10">
              <p className="font-title text-sm tracking-[0.15em] text-wood-600 text-center mb-8">
                What Happens Next
              </p>
              <div className="flex items-start justify-between relative">
                {/* Connecting line behind dots */}
                <div className="absolute top-[7px] left-[calc(16.67%)] right-[calc(16.67%)] h-px bg-wood-200" />
                {EXPECT_STEPS.map((item, i) => (
                  <div key={item.label} className="flex flex-col items-center text-center flex-1 relative z-10">
                    <div
                      className={`w-3.5 h-3.5 rounded-full mb-3 border-2 ${
                        i === 0
                          ? 'bg-bronze-500 border-bronze-500'
                          : 'bg-paper-50 border-wood-300'
                      }`}
                    />
                    <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 font-semibold">
                      {item.label}
                    </p>
                    <p className="font-serif text-xs text-wood-400 mt-1">
                      {item.sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FAQ (scroll-reveal) ───────────────────────────────────── */}
        <div ref={faqReveal.ref} className={faqReveal.cls}>
          <div className="mt-28 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-12">
              <span className="h-px flex-1 bg-wood-200" />
              <h3 className="font-title text-lg tracking-[0.15em] text-wood-900">Common Questions</h3>
              <span className="h-px flex-1 bg-wood-200" />
            </div>
            <div className="space-y-10">
              <div>
                <h4 className="font-serif text-xl text-wood-900 mb-3 font-medium">
                  How long does a commission take?
                </h4>
                <p className="font-serif text-wood-500 leading-[1.8]">
                  Personal pieces typically take 4 to 8 weeks from our first conversation to completion. Spatial commissions and installations vary widely depending on scope, anywhere from 2 months to a year. We'll establish a timeline together once the vision is clear.
                </p>
              </div>
              <div className="h-px bg-wood-100" />
              <div>
                <h4 className="font-serif text-xl text-wood-900 mb-3 font-medium">
                  Where do pieces ship from?
                </h4>
                <p className="font-serif text-wood-500 leading-[1.8]">
                  Most pieces are created in my studio in Bali and ship internationally from there. Ready-to-ship items typically arrive within 2 to 3 weeks. Commissioned work ships upon completion. I handle packaging personally to ensure safe arrival.
                </p>
              </div>
              <div className="h-px bg-wood-100" />
              <div>
                <h4 className="font-serif text-xl text-wood-900 mb-3 font-medium">
                  What sizes are available?
                </h4>
                <p className="font-serif text-wood-500 leading-[1.8]">
                  I work across all scales, from palm-sized talismans and jewelry to room-filling installations. For commissions, size is part of the conversation. For ready-to-ship pieces, dimensions are listed on each piece's page.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Inquire;
