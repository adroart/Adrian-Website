import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

type CommissionType = 'personal' | 'spatial';
type SendStatus = 'IDLE' | 'SENDING' | 'ERROR';

interface FormState {
  name: string;
  email: string;
  vision: string;
  commissionType: CommissionType;
  budget: string;
  timeline: string;
  referral: string;
}

const BUDGET_OPTIONS = [
  'Under $1,000',
  '$1,000 to $5,000',
  '$5,000 to $15,000',
  '$15,000 to $50,000',
  '$50,000+',
  'Let\'s discuss',
];

const TIMELINE_OPTIONS = [
  'Flexible / No rush',
  'Within 3 months',
  'Within 6 months',
  'Within a year',
  'Specific date',
];

const REFERRAL_OPTIONS = [
  'Word of mouth',
  'Instagram',
  'Saw a piece in person',
  'Writings / Blog',
  'Burning Man or festival',
  'Other',
];

const COMMISSION_PATHS = {
  personal: {
    label: 'Personal',
    title: 'Personal Commissions',
    description:
      'Something for your home, your altar, your life. A centerpiece. An alternative to passive consumption. A place to sit with. To feel held. To feel connected. Created from conversation about what wants to exist.',
    image: 'https://picsum.photos/1000/1200?random=inq1',
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
    image: 'https://picsum.photos/1200/1000?random=inq2',
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
  const [coreSubmitted, setCoreSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    vision: '',
    commissionType: 'personal',
    budget: '',
    timeline: '',
    referral: '',
  });

  const visionRef = useRef<HTMLTextAreaElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

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

  /* ── Silent early submit ──────────────────────────────────────────── */
  const requiredValid =
    form.name.trim() !== '' &&
    form.email.trim() !== '' &&
    isValidEmail(form.email) &&
    form.vision.trim() !== '';

  const allRequiredTouched = touched.name && touched.email && touched.vision;

  useEffect(() => {
    if (!coreSubmitted && allRequiredTouched && requiredValid) {
      setCoreSubmitted(true);
      fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          vision: form.vision,
          commissionType: form.commissionType,
        }),
      }).catch(() => {});
    }
  }, [allRequiredTouched, requiredValid, coreSubmitted, form.name, form.email, form.vision, form.commissionType]);

  /* Form completion progress */
  const completionCount = [
    true, // commission type always selected
    form.name.trim(),
    form.email.trim() && isValidEmail(form.email),
    form.vision.trim(),
    form.budget,
    form.timeline,
    form.referral,
  ].filter(Boolean).length;
  const completionPercent = Math.round((completionCount / 7) * 100);

  /* Vision word count */
  const wordCount = form.vision.trim() ? form.vision.trim().split(/\s+/).length : 0;

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
    setCoreSubmitted(false);
    setSendStatus('IDLE');
    setErrorMsg('');
    setForm({ name: '', email: '', vision: '', commissionType: 'personal', budget: '', timeline: '', referral: '' });
    setCommissionType('personal');
    setTouched({});
    setFocused({});
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  const chosenPath = COMMISSION_PATHS[commissionType];

  return (
    <section className="bg-paper-50 min-h-screen animate-fade-in">

      {/* ── Parallax Hero ───────────────────────────────────────────── */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <div ref={heroRef} className="absolute inset-0 will-change-transform">
          <img
            src="https://picsum.photos/1600/900?random=inquire-hero"
            alt="Adrian Rasmussen's studio"
            className="w-full h-[120%] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-wood-900/40 via-wood-900/20 to-paper-50" />
        </div>
        <div className="relative z-10 flex items-end h-full pb-12 px-6">
          <div className="max-w-5xl mx-auto w-full">
            <h1 className="font-serif text-5xl md:text-6xl text-white mb-4 font-medium drop-shadow-lg">
              Inquire
            </h1>
            <p className="font-serif text-xl text-white/80 max-w-2xl leading-[1.7] font-light drop-shadow">
              I take on a small number of commissions each year. Some become
              intimate pieces for personal spaces. Others become installations
              that transform environments.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12 pb-20">

        {/* Opening text */}
        <div className="mb-16 max-w-3xl">
          <p className="font-serif text-lg text-wood-600 leading-[1.7] mb-4">
            I am selective. Not every project is the right project. The right
            ones find me, and I recognize them when they do.
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
                    <h3 className="font-serif text-2xl text-wood-900 mb-3 font-medium">
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

        {/* ── Testimonial (scroll-reveal) ───────────────────────────── */}
        <div ref={testimonialReveal.ref} className={testimonialReveal.cls}>
          <div className="max-w-2xl mx-auto text-center py-8 mb-8">
            <blockquote className="font-serif text-lg text-wood-500 italic leading-[1.8]">
              "Previous commissions have included oracle deck illustrations,
              hand-carved tea tables, festival stage designs, and
              illuminated altar pieces."
            </blockquote>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 mt-4 font-semibold">
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

                {/* ── Form Completion Bar ────────────────────────── */}
                <div className="h-1 bg-wood-100 overflow-hidden">
                  <div
                    className="h-full bg-bronze-500 transition-all duration-500 ease-out"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>

                <div className="bg-wood-50 p-8 md:p-12 border border-wood-100 border-t-0">
                  <p className="font-serif text-xl text-wood-700 leading-[1.7] font-light mb-10">
                    Tell me what you are imagining. We will figure out the details together.
                  </p>

                  {/* Commission Type Toggle */}
                  <div className="mb-10">
                    <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-3">
                      Type of Commission
                    </label>
                    <div className="flex gap-0 border border-wood-300 w-fit">
                      {(Object.keys(COMMISSION_PATHS) as CommissionType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleCommissionType(type)}
                          className={`px-6 py-3 font-label text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-200 ${
                            type !== 'personal' ? 'border-l border-wood-300' : ''
                          } ${
                            commissionType === type
                              ? 'bg-wood-900 text-paper-50'
                              : 'bg-transparent text-wood-500 hover:text-wood-900'
                          }`}
                        >
                          {COMMISSION_PATHS[type].label}
                        </button>
                      ))}
                    </div>
                    <p className="font-serif text-sm text-wood-500 italic mt-2">
                      {commissionType === 'personal'
                        ? 'Pieces for your home, altar, or personal space.'
                        : 'Installations, tea houses, stages, and gathering environments.'}
                    </p>
                  </div>

                  {/* ── Name + Email with Floating Labels ────────── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                    <div className="relative pt-4">
                      <input
                        type="text"
                        name="name"
                        id="field-name"
                        value={form.name}
                        onChange={handleChange}
                        onFocus={() => handleFocus('name')}
                        onBlur={() => handleBlur('name')}
                        className={`w-full bg-transparent border-b pt-2 pb-2 outline-none font-serif text-lg transition-colors duration-300 ${fieldBorderClass('name')}`}
                        required
                      />
                      <label htmlFor="field-name" className={floatLabel('name')}>
                        Name
                      </label>
                      {getFieldError('name') && (
                        <p className="font-serif text-sm text-wood-500 mt-1 animate-fade-in">
                          {getFieldError('name')}
                        </p>
                      )}
                    </div>
                    <div className="relative pt-4">
                      <input
                        type="email"
                        name="email"
                        id="field-email"
                        value={form.email}
                        onChange={handleChange}
                        onFocus={() => handleFocus('email')}
                        onBlur={() => handleBlur('email')}
                        className={`w-full bg-transparent border-b pt-2 pb-2 outline-none font-serif text-lg transition-colors duration-300 ${fieldBorderClass('email')}`}
                        required
                      />
                      <label htmlFor="field-email" className={floatLabel('email')}>
                        Email
                      </label>
                      {getFieldError('email') && (
                        <p className="font-serif text-sm text-wood-500 mt-1 animate-fade-in">
                          {getFieldError('email')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── Vision with Auto-grow + Word Count ───────── */}
                  <div className="mb-10">
                    <label
                      htmlFor="field-vision"
                      className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-2"
                    >
                      What wants to exist?
                    </label>
                    <textarea
                      ref={visionRef}
                      name="vision"
                      id="field-vision"
                      rows={4}
                      value={form.vision}
                      onChange={handleVisionChange}
                      onFocus={() => handleFocus('vision')}
                      onBlur={() => handleBlur('vision')}
                      className={`w-full bg-transparent border-b pt-2 pb-2 outline-none font-serif text-lg resize-none overflow-hidden transition-colors duration-300 ${fieldBorderClass('vision')}`}
                      placeholder="Tell me what you're imagining..."
                      required
                    />
                    <div className="flex justify-between items-center mt-1">
                      {getFieldError('vision') ? (
                        <p className="font-serif text-sm text-wood-500 animate-fade-in">
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

                  {/* ── Divider ──────────────────────────────────── */}
                  <div className="border-t border-wood-200 pt-8 mb-8">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold">
                      If you'd like to share more
                    </p>
                  </div>

                  {/* ── Pill Selectors ───────────────────────────── */}
                  <div className="space-y-8 mb-10">
                    {/* Budget */}
                    <div>
                      <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-3">
                        Budget Range
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {BUDGET_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handlePillSelect('budget', opt)}
                            className={`px-4 py-2 border font-label text-xs tracking-wide transition-all duration-200 active:scale-95 ${
                              form.budget === opt
                                ? 'border-wood-900 bg-wood-900 text-paper-50'
                                : 'border-wood-300 text-wood-600 hover:border-wood-500 hover:text-wood-900 bg-transparent'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div>
                      <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-3">
                        Timeline
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TIMELINE_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handlePillSelect('timeline', opt)}
                            className={`px-4 py-2 border font-label text-xs tracking-wide transition-all duration-200 active:scale-95 ${
                              form.timeline === opt
                                ? 'border-wood-900 bg-wood-900 text-paper-50'
                                : 'border-wood-300 text-wood-600 hover:border-wood-500 hover:text-wood-900 bg-transparent'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Referral */}
                    <div>
                      <label className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-3">
                        How did you find me?
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {REFERRAL_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handlePillSelect('referral', opt)}
                            className={`px-4 py-2 border font-label text-xs tracking-wide transition-all duration-200 active:scale-95 ${
                              form.referral === opt
                                ? 'border-wood-900 bg-wood-900 text-paper-50'
                                : 'border-wood-300 text-wood-600 hover:border-wood-500 hover:text-wood-900 bg-transparent'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
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
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendStatus === 'SENDING'}
                      className="flex items-center gap-3 px-10 py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg disabled:opacity-60 disabled:cursor-wait"
                    >
                      {sendStatus === 'SENDING' ? (
                        <span className="animate-pulse">Sending...</span>
                      ) : (
                        <>Start the conversation <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── "What to expect" micro-timeline (scroll-reveal) ───────── */}
        {!submitted && (
          <div ref={timelineReveal.ref} className={timelineReveal.cls}>
            <div className="mt-12 flex justify-center">
              <div className="flex items-center gap-0">
                {EXPECT_STEPS.map((item, i) => (
                  <React.Fragment key={item.label}>
                    <div className="flex flex-col items-center text-center px-4">
                      <div
                        className={`w-3 h-3 rounded-full mb-3 ${
                          i === 0 ? 'bg-bronze-500' : 'bg-wood-300'
                        }`}
                      />
                      <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 font-semibold">
                        {item.label}
                      </p>
                      <p className="font-serif text-xs text-wood-400 mt-1">
                        {item.sub}
                      </p>
                    </div>
                    {i < EXPECT_STEPS.length - 1 && (
                      <div className="w-12 sm:w-20 h-px bg-wood-300 -mt-6" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Sticky mobile submit ──────────────────────────────────── */}
        {!submitted && requiredValid && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-paper-50/95 backdrop-blur-sm border-t border-wood-200 md:hidden z-40">
            <button
              type="button"
              onClick={() => {
                const formEl = formRef.current?.querySelector('form');
                if (formEl) formEl.requestSubmit();
              }}
              disabled={sendStatus === 'SENDING'}
              className="w-full flex items-center justify-center gap-3 py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg disabled:opacity-60 disabled:cursor-wait"
            >
              {sendStatus === 'SENDING' ? (
                <span className="animate-pulse">Sending...</span>
              ) : (
                <>Start the conversation <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        )}

        {/* ── FAQ (scroll-reveal) ───────────────────────────────────── */}
        <div ref={faqReveal.ref} className={faqReveal.cls}>
          <div className="mt-24 border-t border-wood-200 pt-12 max-w-3xl mx-auto">
            <h3 className="font-serif text-3xl text-wood-900 mb-8 font-medium">Common Questions</h3>
            <div className="space-y-8">
              <div>
                <h4 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-900 font-semibold mb-3">
                  How long does a commission take?
                </h4>
                <p className="font-serif text-wood-600 leading-[1.7]">
                  Personal pieces typically take 4 to 8 weeks from our first conversation to completion. Spatial commissions and installations vary widely depending on scope, anywhere from 2 months to a year. We'll establish a timeline together once the vision is clear.
                </p>
              </div>
              <div>
                <h4 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-900 font-semibold mb-3">
                  Where do pieces ship from?
                </h4>
                <p className="font-serif text-wood-600 leading-[1.7]">
                  Most pieces are created in my studio in Bali and ship internationally from there. Ready-to-ship items typically arrive within 2 to 3 weeks. Commissioned work ships upon completion. I handle packaging personally to ensure safe arrival.
                </p>
              </div>
              <div>
                <h4 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-900 font-semibold mb-3">
                  What sizes are available?
                </h4>
                <p className="font-serif text-wood-600 leading-[1.7]">
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
