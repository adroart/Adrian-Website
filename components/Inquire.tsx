
import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

// Set VITE_FORMSPREE_INQUIRE_ID in .env.local to enable form submissions.
// e.g. VITE_FORMSPREE_INQUIRE_ID=xpwzgjkl
const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_INQUIRE_ID as string | undefined;

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

const STEP_LABELS = ['Choose Path', 'Your Vision', 'Details'];

const EXPECT_STEPS = [
  { label: 'You inquire', sub: 'Right now' },
  { label: 'We talk', sub: 'Within days' },
  { label: 'Creation begins', sub: 'When it\'s right' },
];

const Inquire: React.FC = () => {
  const [step, setStep] = useState(0);
  const [commissionType, setCommissionType] = useState<CommissionType>('personal');
  const [submitted, setSubmitted] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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
  const formTopRef = useRef<HTMLDivElement>(null);

  /* ── #10 Parallax hero scroll effect ──────────────────────────────────── */
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const handleScroll = () => {
      hero.style.transform = `translateY(${window.scrollY * 0.3}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── Form helpers ─────────────────────────────────────────────────────── */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /* #9 Auto-grow textarea */
  const handleVisionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
    const el = visionRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  };

  /* #2 Inline validation */
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

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const fieldBorderClass = (field: string) => {
    const error = getFieldError(field);
    if (error) return 'border-wood-500';
    if (touched[field] && form[field as keyof FormState].trim() && (field !== 'email' || isValidEmail(form.email)))
      return 'border-bronze-400';
    return 'border-wood-300 focus:border-bronze-500';
  };

  const handleCommissionType = (type: CommissionType) => {
    setCommissionType(type);
    setForm(prev => ({ ...prev, commissionType: type }));
  };

  /* #4 Pill toggle */
  const handlePillSelect = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: prev[field] === value ? '' : value }));
  };

  /* ── Step navigation ──────────────────────────────────────────────────── */
  const scrollToFormTop = () => {
    requestAnimationFrame(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const goToStep = (s: number) => {
    setStep(s);
    scrollToFormTop();
  };

  const canProceedFromStep2 =
    form.name.trim() !== '' &&
    form.email.trim() !== '' &&
    isValidEmail(form.email) &&
    form.vision.trim() !== '';

  /* ── Submit ───────────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendStatus('SENDING');
    setErrorMsg('');

    if (FORMSPREE_ID) {
      try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          setSubmitted(true);
          setSendStatus('IDLE');
        } else {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.errors?.[0]?.message || 'Submission failed.');
        }
      } catch (err: any) {
        setSendStatus('ERROR');
        setErrorMsg(err.message || 'Something went wrong. Please try again.');
      }
      return;
    }

    // Fallback: open pre-filled mailto link
    const subject = encodeURIComponent(`Commission Inquiry from ${form.name} (${form.commissionType})`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Type: ${form.commissionType}`,
        form.budget ? `Budget: ${form.budget}` : '',
        form.timeline ? `Timeline: ${form.timeline}` : '',
        form.referral ? `Referral: ${form.referral}` : '',
        '',
        form.vision,
      ]
        .filter(Boolean)
        .join('\n')
    );
    window.location.href = `mailto:hello@adrianrasmussen.art?subject=${subject}&body=${body}`;
    setSubmitted(true);
    setSendStatus('IDLE');
  };

  const handleReset = () => {
    setSubmitted(false);
    setStep(0);
    setSendStatus('IDLE');
    setErrorMsg('');
    setForm({ name: '', email: '', vision: '', commissionType: 'personal', budget: '', timeline: '', referral: '' });
    setCommissionType('personal');
    setTouched({});
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  const chosenPath = COMMISSION_PATHS[commissionType];

  return (
    <section className="bg-paper-50 min-h-screen animate-fade-in">

      {/* ── #10 Parallax Hero ───────────────────────────────────────────── */}
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

        {/* ── #1 Progress Indicator ─────────────────────────────────────── */}
        <div ref={formTopRef} className="scroll-mt-28 mb-12">
          {!submitted && (
            <div className="flex items-center justify-center gap-0 max-w-md mx-auto">
              {STEP_LABELS.map((label, i) => (
                <React.Fragment key={label}>
                  <button
                    type="button"
                    onClick={() => { if (i <= step) goToStep(i); }}
                    className={`flex items-center gap-2 transition-all duration-300 ${
                      i <= step ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-semibold transition-all duration-300 ${
                        i < step
                          ? 'bg-bronze-500 text-white'
                          : i === step
                          ? 'bg-wood-900 text-paper-50'
                          : 'bg-wood-200 text-wood-500'
                      }`}
                    >
                      {i < step ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={`font-mono text-[11px] uppercase tracking-[0.15em] font-semibold hidden sm:block transition-colors duration-300 ${
                        i <= step ? 'text-wood-900' : 'text-wood-400'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-3 transition-colors duration-300 ${
                        i < step ? 'bg-bronze-400' : 'bg-wood-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ── Steps Container ───────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto">

          {submitted ? (
            /* ── #7 Richer Success State ─────────────────────────────────── */
            <div className="max-w-3xl mx-auto">
              <div className="bg-wood-50 border border-wood-100 p-8 md:p-16 text-center relative overflow-hidden">
                {/* Subtle noise texture */}
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

                  {/* Contextual links */}
                  <div className="border-t border-wood-200 pt-8 mb-8">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-4">
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
                    className="font-mono text-xs uppercase tracking-[0.2em] text-wood-500 border-b border-wood-300 pb-1 hover:text-wood-900 hover:border-wood-900 transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ── STEP 1: Commission Type ─────────────────────────────── */}
              {step === 0 && (
                <div>
                  {/* #3 Animated commission path cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    {(Object.keys(COMMISSION_PATHS) as CommissionType[]).map((type) => {
                      const path = COMMISSION_PATHS[type];
                      const isSelected = commissionType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleCommissionType(type)}
                          className={`group text-left border flex flex-col overflow-hidden transition-all duration-500 ${
                            isSelected
                              ? 'border-wood-900 ring-1 ring-wood-900 scale-[1.01]'
                              : 'border-wood-200 hover:border-wood-400 scale-[0.98] opacity-70 hover:opacity-90'
                          }`}
                        >
                          <div className="relative h-[280px] sm:h-[340px] md:h-[380px] overflow-hidden bg-wood-100">
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
                            <div className="absolute top-4 left-4 bg-paper-50/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] font-semibold">
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
                              className={`font-mono text-xs uppercase tracking-[0.2em] font-semibold self-start flex items-center gap-2 transition-all duration-300 ${
                                isSelected
                                  ? 'text-bronze-600'
                                  : 'text-wood-500 group-hover:text-wood-900'
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

                  {/* #8 Testimonial / past commissions quote */}
                  <div className="max-w-2xl mx-auto text-center mb-10 py-8">
                    <blockquote className="font-serif text-lg text-wood-500 italic leading-[1.8] border-l-0 pl-0">
                      "Previous commissions have included oracle deck illustrations,
                      hand-carved tea tables, festival stage designs, and
                      illuminated altar pieces."
                    </blockquote>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-wood-400 mt-4 font-semibold">
                      From the Studio
                    </p>
                  </div>

                  {/* Continue button */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="flex items-center gap-3 px-10 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg"
                    >
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Your Vision ─────────────────────────────────── */}
              {step === 1 && (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-wood-50 p-8 md:p-12 border border-wood-100">
                    <p className="font-serif text-xl text-wood-700 leading-[1.7] font-light mb-8">
                      Tell me what you are imagining. We will figure out the
                      details together.
                    </p>

                    <div className="space-y-8">
                      {/* Name + Email */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-wood-500 font-semibold">
                            Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            onBlur={() => handleBlur('name')}
                            className={`w-full bg-transparent border-b py-2 outline-none font-serif text-lg transition-colors duration-300 ${fieldBorderClass('name')}`}
                            required
                          />
                          {getFieldError('name') && (
                            <p className="font-serif text-sm text-wood-500 animate-fade-in">
                              {getFieldError('name')}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-wood-500 font-semibold">
                            Email
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            onBlur={() => handleBlur('email')}
                            className={`w-full bg-transparent border-b py-2 outline-none font-serif text-lg transition-colors duration-300 ${fieldBorderClass('email')}`}
                            required
                          />
                          {getFieldError('email') && (
                            <p className="font-serif text-sm text-wood-500 animate-fade-in">
                              {getFieldError('email')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* #9 Auto-growing Vision textarea */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-wood-500 font-semibold">
                          What wants to exist?
                        </label>
                        <textarea
                          ref={visionRef}
                          name="vision"
                          rows={4}
                          value={form.vision}
                          onChange={handleVisionChange}
                          onBlur={() => handleBlur('vision')}
                          className={`w-full bg-transparent border-b py-2 outline-none font-serif text-lg resize-none overflow-hidden transition-colors duration-300 ${fieldBorderClass('vision')}`}
                          placeholder="Tell me what you're imagining..."
                          required
                        />
                        {getFieldError('vision') && (
                          <p className="font-serif text-sm text-wood-500 animate-fade-in">
                            {getFieldError('vision')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-8">
                      <button
                        type="button"
                        onClick={() => goToStep(0)}
                        className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 transition-colors font-semibold"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTouched({ name: true, email: true, vision: true });
                          if (canProceedFromStep2) goToStep(2);
                        }}
                        disabled={!canProceedFromStep2}
                        className="hidden md:flex items-center gap-3 px-10 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Continue <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* #6 Sticky mobile continue bar */}
                  <div className="fixed bottom-0 left-0 right-0 p-4 bg-paper-50/95 backdrop-blur-sm border-t border-wood-200 md:hidden z-40">
                    <button
                      type="button"
                      onClick={() => {
                        setTouched({ name: true, email: true, vision: true });
                        if (canProceedFromStep2) goToStep(2);
                      }}
                      disabled={!canProceedFromStep2}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Details (all optional) + Submit ─────────────── */}
              {step === 2 && (
                <form className="max-w-3xl mx-auto" onSubmit={handleSubmit}>
                  <div className="bg-wood-50 p-8 md:p-12 border border-wood-100">
                    <p className="font-serif text-xl text-wood-700 leading-[1.7] font-light mb-2">
                      A few more things, if you'd like to share.
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-10">
                      All optional
                    </p>

                    {/* #4 Pill selectors */}
                    <div className="space-y-10">
                      {/* Budget */}
                      <div>
                        <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-4">
                          Budget Range
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {BUDGET_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handlePillSelect('budget', opt)}
                              className={`px-4 py-2 border font-mono text-xs tracking-wide transition-all duration-200 ${
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
                        <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-4">
                          Timeline
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {TIMELINE_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handlePillSelect('timeline', opt)}
                              className={`px-4 py-2 border font-mono text-xs tracking-wide transition-all duration-200 ${
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
                        <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-wood-500 font-semibold block mb-4">
                          How did you find me?
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {REFERRAL_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handlePillSelect('referral', opt)}
                              className={`px-4 py-2 border font-mono text-xs tracking-wide transition-all duration-200 ${
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

                    {/* Error message */}
                    {sendStatus === 'ERROR' && (
                      <div className="flex items-start gap-3 p-4 border border-wood-300 bg-white text-wood-700 mt-8">
                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-wood-500" />
                        <p className="font-serif text-sm">{errorMsg}</p>
                      </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-10">
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 transition-colors font-semibold"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={sendStatus === 'SENDING'}
                        className="hidden md:flex items-center gap-3 px-10 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg disabled:opacity-60 disabled:cursor-wait"
                      >
                        {sendStatus === 'SENDING' ? (
                          <span className="animate-pulse">Sending...</span>
                        ) : (
                          <>Start the conversation <ArrowRight size={14} /></>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* #5 "What to expect" micro-timeline */}
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
                            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-700 font-semibold">
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

                  {/* #6 Sticky mobile submit bar */}
                  <div className="fixed bottom-0 left-0 right-0 p-4 bg-paper-50/95 backdrop-blur-sm border-t border-wood-200 md:hidden z-40">
                    <button
                      type="submit"
                      disabled={sendStatus === 'SENDING'}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors font-semibold shadow-lg disabled:opacity-60 disabled:cursor-wait"
                    >
                      {sendStatus === 'SENDING' ? (
                        <span className="animate-pulse">Sending...</span>
                      ) : (
                        <>Start the conversation <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Below Form - Light Codes */}
        <div className="mt-12 text-center max-w-3xl mx-auto">
          <p className="font-serif text-wood-600">
            Light Codes can also be created for you.{' '}
            <a
              href="/series/light-codes"
              className="text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
            >
              Learn more
            </a>
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-24 border-t border-wood-200 pt-12 max-w-3xl mx-auto">
          <h3 className="font-serif text-3xl text-wood-900 mb-8 font-medium">Common Questions</h3>
          <div className="space-y-8">
            <div>
              <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-900 font-semibold mb-3">
                How long does a commission take?
              </h4>
              <p className="font-serif text-wood-600 leading-[1.7]">
                Personal pieces typically take 4 to 8 weeks from our first conversation to completion. Spatial commissions and installations vary widely depending on scope, anywhere from 2 months to a year. We'll establish a timeline together once the vision is clear.
              </p>
            </div>
            <div>
              <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-900 font-semibold mb-3">
                Where do pieces ship from?
              </h4>
              <p className="font-serif text-wood-600 leading-[1.7]">
                Most pieces are created in my studio in Bali and ship internationally from there. Ready-to-ship items typically arrive within 2 to 3 weeks. Commissioned work ships upon completion. I handle packaging personally to ensure safe arrival.
              </p>
            </div>
            <div>
              <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-900 font-semibold mb-3">
                What sizes are available?
              </h4>
              <p className="font-serif text-wood-600 leading-[1.7]">
                I work across all scales, from palm-sized talismans and jewelry to room-filling installations. For commissions, size is part of the conversation. For ready-to-ship pieces, dimensions are listed on each piece's page.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Inquire;
