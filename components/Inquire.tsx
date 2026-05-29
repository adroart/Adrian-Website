import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { img } from '../utils/cloudinary';

// Update this with your actual WhatsApp number (international format, no + or spaces, e.g. 6281234567890)
const WHATSAPP_NUMBER = '18313259164';

type CommissionType = 'personal' | 'spatial';
type SendStatus = 'IDLE' | 'SENDING' | 'ERROR';

interface FormState {
  name: string;
  email: string;
  vision: string;
  commissionType: CommissionType;
  budget: string;
  location: string;
}

const BUDGET_PRESETS = [
  { label: 'Under $1,000', value: 'Under $1,000' },
  { label: '$1,000 to $5,000', value: '$1,000 to $5,000' },
  { label: '$5,000 to $15,000', value: '$5,000 to $15,000' },
  { label: '$15,000+', value: '$15,000+' },
];

// Budget tiers at or above this floor warrant a scheduled call.
// Below the floor ('Under $1,000'), the inquiry is handled by email only.
const CALL_BUDGET_VALUES = new Set<string>([
  '$1,000 to $5,000',
  '$5,000 to $15,000',
  '$15,000+',
]);

const COMMISSION_PATHS = {
  personal: {
    label: 'Personal',
    title: 'Personal Commissions',
    description:
      'Something for your home, your altar, your life. A centerpiece. An alternative to passive consumption. A place to sit with. To feel held. To feel connected. Created from conversation about what wants to exist.',
    image: img('Untitled_eidlbn', { w: 1400, h: 800, crop: 'fit', gravity: 'center' }),
    alt: 'Personal commission piece by Adrian Rasmussen',
    successMsg: 'Your vision for a personal piece is on its way to the studio.',
    suggestLink: '/creations',
    suggestLabel: 'Explore the Creations',
    forText: 'For a personal piece',
    otherType: 'spatial' as CommissionType,
    otherLabel: 'spatial',
  },
  spatial: {
    label: 'Spatial',
    title: 'Spatial Commissions',
    description:
      'When you walk into a space, there is something you can feel. I love creating spaces that bring this through. Installations. Tea houses. Stages. The art, the ceremony, the intention. All in service of what happens between people when presence is held.',
    image: img('72CAF335-30B9-412C-9FB7-6F92BA637FF8_lb9gzp', { w: 1200, h: 800, gravity: 'center' }),
    alt: 'Spatial installation by Adrian Rasmussen',
    successMsg: 'Your spatial vision is on its way to the studio.',
    suggestLink: '/creations/multidimensional-art',
    suggestLabel: 'See Spatial Installations',
    forText: 'For a spatial installation',
    otherType: 'personal' as CommissionType,
    otherLabel: 'personal',
  },
} as const;

const EXPECT_STEPS = [
  { label: 'You inquire', sub: 'Right now' },
  { label: 'We talk', sub: 'Within days' },
  { label: 'Creation begins', sub: "When it's right" },
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
          if (delay) setTimeout(() => setVisible(true), delay);
          else setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  const cls = `transition-all duration-700 ease-out ${
    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
  }`;

  return { ref, cls };
}

/* ══════════════════════════════════════════════════════════════════════ */

const Inquire: React.FC = () => {
  const [commissionType, setCommissionType] = useState<CommissionType>('personal');
  const [submitted, setSubmitted] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [mailtoFallback, setMailtoFallback] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focused, setFocused] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    vision: '',
    commissionType: 'personal',
    budget: '',
    location: '',
  });

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const visionRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const optionalRef = useRef<HTMLDivElement>(null);
  const prevRequiredValidRef = useRef(false);

  /* ── Pre-fill + auto-scroll when arriving from a piece page ───────── */
  const routerLocation = useLocation();
  const [prefilled, setPrefilled] = useState(false);
  const [pieceTitle, setPieceTitle] = useState('');

  const routerState = routerLocation.state as {
    piece?: string;
    pieceId?: string;
    mode?: 'purchase';
    price?: string;
    size?: string;
    addOns?: string[];
    availability?: string;
  } | null;

  const purchaseMode = routerState?.mode === 'purchase';
  const purchasePrice = routerState?.price ?? '';
  const purchaseSize = routerState?.size ?? '';
  const purchaseAddOns = routerState?.addOns ?? [];
  const purchaseAvailability = routerState?.availability ?? '';

  useEffect(() => {
    const piece = routerState?.piece;
    if (piece) {
      let prefillText: string;
      if (routerState?.mode === 'purchase') {
        prefillText = ''; // Notes field stays empty; purchase details shown in the summary card
      } else {
        prefillText = `I'm interested in a piece similar to "${piece}".`;
      }
      setForm(prev => ({ ...prev, vision: prefillText }));
      setPrefilled(routerState?.mode !== 'purchase');
      setPieceTitle(piece);
      requestAnimationFrame(() => {
        if (visionRef.current) {
          visionRef.current.style.height = 'auto';
          visionRef.current.style.height = visionRef.current.scrollHeight + 'px';
        }
        // Delay to let the page finish rendering before scrolling
        setTimeout(() => {
          formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerLocation.state]);

  const handleVisionFocus = () => {
    if (prefilled) setPrefilled(false);
  };

  /* ── Scroll reveals ────────────────────────────────────────────────── */
  const cardsReveal = useReveal();
  const testimonialReveal = useReveal(150);
  const formReveal = useReveal();
  const timelineReveal = useReveal(100);
  const faqReveal = useReveal();

  /* ── Navigation warning ────────────────────────────────────────────── */
  const visionIsDirty = form.vision !== '' && !prefilled;
  const isDirty = !submitted && (
    form.name !== '' || form.email !== '' || visionIsDirty ||
    form.budget !== '' || form.location !== ''
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* ── Form helpers ─────────────────────────────────────────────────── */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleVisionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
    const el = visionRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const getFieldError = (field: string): string | null => {
    if (!touched[field]) return null;
    const value = form[field as keyof FormState];
    if (field === 'name' && !value.trim()) return 'Please enter your name';
    if (field === 'email' && !value.trim()) return 'Please enter your email';
    if (field === 'email' && !isValidEmail(value)) return 'Please enter a valid email';
    if (field === 'vision' && !purchaseMode && !value.trim()) return 'Please share your vision';
    return null;
  };

  const handleFocus = (field: string) => setFocused(prev => ({ ...prev, [field]: true }));

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFocused(prev => ({ ...prev, [field]: false }));
  };

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
    if (
      touched[field] &&
      form[field as keyof FormState].trim() &&
      (field !== 'email' || isValidEmail(form.email))
    )
      return 'border-bronze-400';
    return 'border-wood-200 focus:border-wood-700';
  };

  const floatLabel = (field: string) => {
    const isUp = focused[field] || form[field as keyof FormState]?.trim();
    return `absolute left-0 pointer-events-none font-label uppercase tracking-[0.1em] font-semibold transition-all duration-200 ${
      isUp ? 'top-0 text-[10px] text-wood-500' : 'top-3 text-xs text-wood-500'
    }`;
  };

  const handleCommissionType = (type: CommissionType) => {
    setCommissionType(type);
    setForm(prev => ({ ...prev, commissionType: type }));
  };

  /* ── Required fields ──────────────────────────────────────────────── */
  const requiredCount = [
    form.name.trim(),
    form.email.trim() && isValidEmail(form.email),
    purchaseMode || form.vision.trim(),
  ].filter(Boolean).length;

  const requiredValid = requiredCount === 3;

  /* ── Scroll optional section into view when it first opens ────────── */
  useEffect(() => {
    if (requiredValid && !prevRequiredValidRef.current) {
      setTimeout(() => {
        optionalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 400);
    }
    prevRequiredValidRef.current = requiredValid;
  }, [requiredValid]);

  /* ── Submit ───────────────────────────────────────────────────────── */
  const buildMailtoFallback = () => {
    const subject = purchaseMode
      ? encodeURIComponent(`Purchase Request: ${pieceTitle}`)
      : encodeURIComponent(`Commission Inquiry: ${COMMISSION_PATHS[form.commissionType].label}`);
    const parts = purchaseMode
      ? [
          `Name: ${form.name}`,
          `Email: ${form.email}`,
          '',
          `Piece: ${pieceTitle}`,
          ...(purchaseSize ? [`Size: ${purchaseSize}`] : []),
          ...(purchaseAddOns.length ? [`Add-ons: ${purchaseAddOns.join(', ')}`] : []),
          ...(purchaseAvailability ? [`Availability: ${purchaseAvailability}`] : []),
          ...(purchasePrice ? [`Price: ${purchasePrice}`] : []),
          ...(form.vision ? ['', `Notes: ${form.vision}`] : []),
        ]
      : [
          `Name: ${form.name}`,
          `Email: ${form.email}`,
          '',
          `Commission type: ${form.commissionType}`,
          '',
          `Vision: ${form.vision}`,
        ];
    if (form.budget) parts.push(`Budget: ${form.budget}`);
    if (form.location) parts.push(`Location: ${form.location}`);
    const body = encodeURIComponent(parts.join('\n'));
    return `mailto:hello@adrianrasmussen.com?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(prev => ({ ...prev, name: true, email: true, ...(!purchaseMode && { vision: true }) }));
    if (!requiredValid) return;
    setSendStatus('SENDING');
    setErrorMsg('');
    setMailtoFallback('');
    try {
      const res = await fetch('/api/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseMode
          ? {
              ...form,
              inquiryType: 'purchase',
              pieceTitle,
              purchaseSize,
              purchaseAddOns,
              purchaseAvailability,
              purchasePrice,
            }
          : form
        ),
      });
      if (res.ok) {
        setSubmitted(true);
        setSendStatus('IDLE');

        // Conversion tracking
        window.dispatchEvent(new CustomEvent('inquiry_submitted', {
          detail: {
            commissionType: form.commissionType,
            budget: form.budget,
          },
        }));

        // Cloudflare Zaraz (if available)
        try {
          if (typeof window !== 'undefined' && (window as { zaraz?: { track: (event: string, data: Record<string, string>) => void } }).zaraz) {
            (window as { zaraz?: { track: (event: string, data: Record<string, string>) => void } }).zaraz!.track('inquiry_submitted', {
              commission_type: form.commissionType,
              budget: form.budget,
            });
          }
        } catch { /* ignore */ }
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Submission failed.');
      }
    } catch (err) {
      setSendStatus('ERROR');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong sending your inquiry.');
      setMailtoFallback(buildMailtoFallback());
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSendStatus('IDLE');
    setErrorMsg('');
    setMailtoFallback('');
    setForm({
      name: '', email: '', vision: '', commissionType: 'personal',
      budget: '', location: '',
    });
    setCommissionType('personal');
    setTouched({});
    setFocused({});
    setPrefilled(false);
    setPieceTitle('');
  };

  /* ── Helpers ──────────────────────────────────────────────────────── */
  const chosenPath = COMMISSION_PATHS[commissionType];

  /* Reusable submit button - used twice (above and below optional fields) */
  const submitBtn = (
    <button
      type="submit"
      disabled={sendStatus === 'SENDING'}
      className="inline-flex items-center gap-3 px-10 py-3.5 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.15em] font-semibold hover:bg-bronze-600 transition-all duration-300 disabled:bg-wood-200 disabled:text-wood-600 disabled:cursor-not-allowed"
    >
      {sendStatus === 'SENDING' ? (
        <span className="animate-pulse">Sending...</span>
      ) : purchaseMode ? (
        <>Send purchase request <ArrowRight size={13} /></>
      ) : (
        <>Start the conversation <ArrowRight size={13} /></>
      )}
    </button>
  );

  const errorBlock = sendStatus === 'ERROR' && (
    <div className="flex flex-col gap-3 p-4 border border-wood-300 bg-white mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="shrink-0 mt-0.5 text-wood-600" />
        <p className="font-sans text-sm text-red-700">{errorMsg}</p>
      </div>
      {mailtoFallback && (
        <a
          href={mailtoFallback}
          className="font-label text-xs uppercase tracking-[0.15em] font-semibold text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
        >
          Send via email instead
        </a>
      )}
    </div>
  );

  return (
    <section className="bg-paper-50 min-h-screen animate-fade-in">
      <div className="max-w-5xl mx-auto px-6 pt-32 pb-20">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="text-center mb-16">
          <h1 className="font-serif text-5xl md:text-7xl text-wood-900 font-medium mb-4">
            Inquire
          </h1>
          <p className="font-sans text-lg md:text-xl text-wood-600 max-w-lg mx-auto leading-relaxed mb-10">
            Commissions and collaborations.
          </p>
          <div className="max-w-2xl mx-auto">
            <p className="font-serif text-xl md:text-2xl text-wood-700 leading-[1.65] mb-6">
              I take on a small number of commissions each year. Some become
              intimate pieces for personal spaces. Others become installations
              that transform environments.
            </p>
            <span className="block w-10 h-px bg-bronze-400/50 mx-auto mb-6" />
            <p className="font-sans text-lg text-wood-600 leading-[1.75] mb-2">
              I am selective. Not every project is the right project.
              The right ones find me, and I recognize them when they do.
            </p>
            <p className="font-sans text-lg text-wood-700 leading-[1.75]">
              If you are feeling a pull toward working together, trust that.
            </p>
          </div>
        </div>

        {/* ── Commission Path Cards + Testimonials (commission mode only) */}
        {!purchaseMode && (<>
        <div ref={cardsReveal.ref} className={cardsReveal.cls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
                  <div className="relative h-[220px] sm:h-[260px] md:h-[280px] overflow-hidden bg-wood-100">
                    <img
                      src={path.image}
                      className={`w-full h-full object-cover object-center transition-all duration-700 ease-out ${
                        isSelected
                          ? 'grayscale-0 scale-[1.02]'
                          : 'grayscale-[30%] scale-100 group-hover:grayscale-[15%] group-hover:scale-[1.01]'
                      }`}
                      alt={path.alt}
                      loading="lazy"
                    />
                    <div
                      className={`absolute inset-0 bg-wood-900 transition-opacity duration-500 ${
                        isSelected ? 'opacity-0' : 'opacity-10'
                      }`}
                    />
                  </div>
                  <div className="p-5 md:p-6 flex flex-col flex-1 bg-white">
                    <h2 className="font-label text-lg tracking-[0.08em] text-wood-900 mb-2">
                      {path.title}
                    </h2>
                    <p
                      className={`font-sans text-wood-600 leading-[1.7] mb-4 flex-1 text-sm transition-all duration-500 overflow-hidden ${
                        isSelected ? 'max-h-40 opacity-100' : 'max-h-16 opacity-60'
                      }`}
                    >
                      {path.description}
                    </p>
                    <span
                      className={`font-label text-xs uppercase tracking-[0.15em] font-semibold self-start flex items-center gap-2 transition-all duration-300 ${
                        isSelected
                          ? 'text-bronze-600'
                          : 'text-wood-600 group-hover:text-wood-900'
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

        {/* ── Past commission types ──────────────────────────────────── */}
        <div ref={testimonialReveal.ref} className={testimonialReveal.cls}>
          <div className="max-w-2xl mx-auto text-center py-6 mb-4">
            <p className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold mb-4">
              Past Commissions Include
            </p>
            <p className="font-sans text-lg text-wood-600 leading-[1.7]">
              Oracle deck illustrations, hand-carved furniture, festival stage designs,
              and illuminated altar pieces.
            </p>
          </div>
        </div>
        </>)}

        {/* ── Form ──────────────────────────────────────────────────── */}
        <div ref={formReveal.ref} className={formReveal.cls}>
          <div ref={formRef} className="max-w-3xl mx-auto scroll-mt-28">

            {submitted ? (
              /* ── Success ──────────────────────────────────────────── */
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
                    {purchaseMode ? 'Purchase request received.' : 'The conversation has begun.'}
                  </h4>
                  <p className="font-serif text-xl text-wood-700 leading-[1.7] mb-2">
                    {purchaseMode
                      ? `Your request for "${pieceTitle}" is on its way to the studio.`
                      : chosenPath.successMsg
                    }
                  </p>
                  <p className="font-serif text-wood-600 leading-[1.7] mb-10">
                    {purchaseMode
                      ? 'I will confirm the details and follow up with next steps within a couple of days, including a separate note about shipping for your destination.'
                      : CALL_BUDGET_VALUES.has(form.budget)
                        ? "I'll be in touch within a few days. If the project feels like a fit, we'll schedule a call to talk it through."
                        : "I'll be in touch within a few days by email."
                    }
                  </p>
                  <div className="border-t border-wood-200 pt-8 mb-8">
                    <p className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold mb-4">
                      While you wait
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Link
                        to={chosenPath.suggestLink}
                        className="font-serif text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
                      >
                        {chosenPath.suggestLabel}
                      </Link>
                      <span className="hidden sm:inline text-wood-300">&middot;</span>
                      <Link
                        to="/writings"
                        className="font-serif text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
                      >
                        Read the Writings
                      </Link>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="font-label text-xs uppercase tracking-[0.15em] text-wood-700 border-b border-wood-300 pb-1 hover:text-wood-900 hover:border-wood-900 transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              /* ── Form ─────────────────────────────────────────────── */
              <form onSubmit={handleSubmit}>
                <fieldset
                  disabled={sendStatus === 'SENDING'}
                  className="disabled:opacity-60 disabled:pointer-events-none transition-opacity duration-300"
                >
                  {/* The form card */}
                  <div className="bg-wood-50 border border-wood-100 p-10 md:p-16">

                    {/* ── Header: purchase, prefilled commission, or open ─── */}
                    {purchaseMode && pieceTitle ? (
                      /* Purchase mode: piece summary card */
                      <div className="mb-8">
                        <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 mb-4">
                          Purchase request
                        </p>
                        <div className="border border-wood-200 bg-white p-5 mb-2 space-y-2">
                          <p className="font-serif text-xl text-wood-900 leading-[1.3]">{pieceTitle}</p>
                          {purchaseSize && (
                            <p className="font-sans text-sm text-wood-600">
                              <span className="font-label text-[10px] uppercase tracking-[0.12em] text-wood-400 font-semibold mr-2">Size</span>
                              {purchaseSize}
                            </p>
                          )}
                          {purchaseAddOns.length > 0 && (
                            <p className="font-sans text-sm text-wood-600">
                              <span className="font-label text-[10px] uppercase tracking-[0.12em] text-wood-400 font-semibold mr-2">Add-ons</span>
                              {purchaseAddOns.join(', ')}
                            </p>
                          )}
                          {purchaseAvailability && (
                            <p className="font-sans text-sm text-wood-600">
                              <span className="font-label text-[10px] uppercase tracking-[0.12em] text-wood-400 font-semibold mr-2">Availability</span>
                              {purchaseAvailability}
                            </p>
                          )}
                          {purchasePrice && (
                            <p className="font-serif text-2xl text-wood-900 font-medium pt-1">
                              {purchasePrice}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : pieceTitle ? (
                      /* Prefilled commission: piece title IS the heading */
                      <div className="mb-[6px]">
                        <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 mb-3">
                          Commission inquiry
                        </p>
                        <p className="font-serif text-2xl md:text-3xl text-wood-900 leading-[1.25] mb-1">
                          {pieceTitle}
                        </p>
                        <p className="font-sans text-sm text-wood-500">
                          {chosenPath.forText}
                        </p>
                      </div>
                    ) : (
                      /* Normal: open-ended heading */
                      <div className="mb-[6px]">
                        <p className="font-serif text-2xl md:text-3xl text-wood-900 leading-[1.25] mb-1">
                          Tell me what you are imagining.
                        </p>
                        <p className="font-sans text-sm text-wood-500">
                          {chosenPath.forText}.{' '}
                          <button
                            type="button"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="text-bronze-400 hover:text-bronze-600 underline underline-offset-2 decoration-1 transition-colors"
                          >
                            Change
                          </button>
                        </p>
                      </div>
                    )}

                    {/* ── Vision (commission mode only - shown above name) ── */}
                    {!purchaseMode && (
                    <div className="mb-[6px]">
                      <label
                        htmlFor="field-vision"
                        className="block font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 font-semibold mb-2"
                      >
                        {!pieceTitle ? 'What wants to exist?' : null}
                      </label>
                      <textarea
                        ref={visionRef}
                        name="vision"
                        id="field-vision"
                        rows={1}
                        value={form.vision}
                        onChange={handleVisionChange}
                        onFocus={() => {
                          handleFocus('vision');
                          handleVisionFocus();
                        }}
                        onBlur={() => handleBlur('vision')}
                        aria-describedby={getFieldError('vision') ? 'vision-error' : undefined}
                        className={`w-full bg-transparent border-b-2 pb-[6px] outline-none font-sans text-base resize-none overflow-hidden transition-colors duration-300 leading-relaxed text-wood-700 ${fieldBorderClass('vision')}`}
                        placeholder="A piece for my meditation space, something that holds stillness..."
                        required
                      />
                      {getFieldError('vision') && (
                        <p id="vision-error" role="alert" className="font-sans text-sm text-red-700 mt-1.5 animate-fade-in">
                          {getFieldError('vision')}
                        </p>
                      )}
                    </div>
                    )}

                    {/* ── Name ──────────────────────────────────────────── */}
                    <div className="mb-[6px] relative pt-3">
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
                        className={`w-full bg-transparent border-b-2 pt-1 pb-[6px] outline-none font-sans text-base transition-colors duration-300 text-wood-900 ${fieldBorderClass('name')}`}
                        required
                      />
                      <label htmlFor="field-name" className={floatLabel('name')}>
                        Name
                      </label>
                      {touched.name && !getFieldError('name') && form.name.trim() && (
                        <Check size={13} className="absolute right-0 top-6 text-bronze-400 animate-fade-in" strokeWidth={2.5} />
                      )}
                      {getFieldError('name') && (
                        <p id="name-error" role="alert" className="font-sans text-sm text-red-700 mt-1 animate-fade-in">
                          {getFieldError('name')}
                        </p>
                      )}
                    </div>

                    {/* ── Email ─────────────────────────────────────────── */}
                    <div className="mb-[6px] relative pt-3">
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
                        className={`w-full bg-transparent border-b-2 pt-1 pb-[6px] outline-none font-sans text-base transition-colors duration-300 text-wood-900 ${fieldBorderClass('email')}`}
                        required
                      />
                      <label htmlFor="field-email" className={floatLabel('email')}>
                        Email
                      </label>
                      {touched.email && !getFieldError('email') && form.email.trim() && isValidEmail(form.email) && (
                        <Check size={13} className="absolute right-0 top-6 text-bronze-400 animate-fade-in" strokeWidth={2.5} />
                      )}
                      {getFieldError('email') && (
                        <p id="email-error" role="alert" className="font-sans text-sm text-red-700 mt-1 animate-fade-in">
                          {getFieldError('email')}
                        </p>
                      )}
                    </div>

                    {/* ── Notes / Questions (purchase mode only - shown below name+email) */}
                    {purchaseMode && (
                    <div className="mb-[6px] pt-3">
                      <label
                        htmlFor="field-vision"
                        className="block font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 font-semibold mb-2"
                      >
                        Notes or questions
                      </label>
                      <textarea
                        ref={visionRef}
                        name="vision"
                        id="field-vision"
                        rows={3}
                        value={form.vision}
                        onChange={handleVisionChange}
                        onFocus={() => {
                          handleFocus('vision');
                          handleVisionFocus();
                        }}
                        onBlur={() => handleBlur('vision')}
                        className={`w-full bg-transparent border-b-2 pb-[6px] outline-none font-sans text-base resize-none overflow-hidden transition-colors duration-300 leading-relaxed text-wood-700 ${fieldBorderClass('vision')}`}
                        placeholder="Questions or any special requests..."
                      />
                    </div>
                    )}

                    {/* ── Submit ────────────────────────────────────────── */}
                    <div>
                      {errorBlock}
                      {submitBtn}
                      <div className="mt-4 flex flex-col gap-2">
                        {purchaseMode ? (
                          <div className="flex flex-col gap-1.5">
                            <p className="font-sans text-sm text-wood-400">
                              Or reach out directly:
                            </p>
                            <p className="font-sans text-sm text-wood-400">
                              <a
                                href="mailto:hello@adrianrasmussen.com"
                                className="text-bronze-400 hover:text-bronze-600 transition-colors"
                              >
                                hello@adrianrasmussen.com
                              </a>
                              {WHATSAPP_NUMBER && (
                                <>
                                  {' · '}
                                  <a
                                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-bronze-400 hover:text-bronze-600 transition-colors"
                                  >
                                    WhatsApp
                                  </a>
                                </>
                              )}
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="font-sans text-sm text-wood-400">
                              Or write directly:{' '}
                              <a
                                href="mailto:hello@adrianrasmussen.com"
                                className="text-bronze-400 hover:text-bronze-600 transition-colors"
                              >
                                hello@adrianrasmussen.com
                              </a>
                            </p>
                            {pieceTitle && (
                              <button
                                type="button"
                                onClick={() => handleCommissionType(chosenPath.otherType)}
                                className="text-left font-sans text-sm text-wood-400 hover:text-wood-600 transition-colors"
                              >
                                Switch to {chosenPath.otherLabel} commission instead
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* ── Optional Fields (commission mode only) ────────── */}
                    {!purchaseMode && <div className={`form-reveal ${requiredValid ? 'is-open' : ''}`}>
                      <div className="form-reveal-inner" ref={optionalRef}>
                        <div className="border-t border-wood-150 pt-8 mt-8 mb-8">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex-1 h-px bg-wood-100" />
                            <span className="font-label text-[11px] text-bronze-400 tracking-[0.15em] uppercase">
                              Optional details
                            </span>
                            <span className="flex-1 h-px bg-wood-100" />
                          </div>
                          <p className="font-sans text-sm text-wood-500 text-center">
                            Helps me prepare for our conversation.
                          </p>
                        </div>

                        <div className="space-y-10 mb-10">

                          {/* Budget */}
                          <div>
                            <label
                              htmlFor="field-budget"
                              className="block font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-3"
                            >
                              Budget Range
                            </label>
                            <select
                              id="field-budget"
                              name="budget"
                              value={form.budget}
                              onChange={(e) => setForm(prev => ({ ...prev, budget: e.target.value }))}
                              className="w-full bg-transparent border-b border-wood-200 py-2 font-sans text-base text-wood-900 outline-none focus:border-wood-700 transition-colors appearance-none cursor-pointer"
                            >
                              <option value="">Select a range</option>
                              {BUDGET_PRESETS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Location */}
                          <div className="relative pt-5">
                            <label htmlFor="field-location" className={floatLabel('location')}>
                              Location
                            </label>
                            <input
                              type="text"
                              name="location"
                              id="field-location"
                              value={form.location}
                              onChange={handleChange}
                              onFocus={() => handleFocus('location')}
                              onBlur={() => handleBlur('location')}
                              className="w-full border-b border-wood-200 focus:border-wood-700 bg-transparent py-2 font-sans text-lg text-wood-900 outline-none transition-colors"
                            />
                            <p className="font-sans text-sm text-wood-500 mt-1.5">
                              City, country, or region where the piece will live.
                            </p>
                          </div>
                        </div>

                        {/* Second submit (after optional fields) */}
                        <div className="pt-2">
                          {errorBlock}
                          {submitBtn}
                        </div>
                      </div>
                    </div>}
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        </div>

        {/* ── "What to expect" micro-timeline ───────────────────────── */}
        {!submitted && (
          <div ref={timelineReveal.ref} className={timelineReveal.cls}>
            <div className="mt-20 max-w-xl mx-auto border border-wood-100 bg-wood-50 px-8 py-10">
              <p className="font-label text-sm tracking-[0.15em] text-wood-700 text-center mb-8">
                What Happens Next
              </p>
              <div className="flex items-start justify-between relative">
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
                    <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-700 font-semibold">
                      {item.label}
                    </p>
                    <p className="font-sans text-sm text-wood-700 mt-1">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <div ref={faqReveal.ref} className={faqReveal.cls}>
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-10">
              <span className="h-px flex-1 bg-wood-200" />
              <h2 className="font-label text-base tracking-[0.15em] text-wood-900">
                Common Questions
              </h2>
              <span className="h-px flex-1 bg-wood-200" />
            </div>
            <div className="space-y-8">
              <div>
                <h4 className="font-sans text-lg text-wood-900 mb-2 font-medium">
                  How long does a commission take?
                </h4>
                <p className="font-sans text-base text-wood-600 leading-[1.8]">
                  Personal pieces typically take 4 to 8 weeks from our first conversation to
                  completion. Spatial commissions and installations vary widely depending on
                  scope, anywhere from 2 months to a year. We'll establish a timeline together
                  once the vision is clear.
                </p>
              </div>
              <div className="h-px bg-wood-100" />
              <div>
                <h4 className="font-sans text-lg text-wood-900 mb-2 font-medium">
                  Where do pieces ship from?
                </h4>
                <p className="font-sans text-base text-wood-600 leading-[1.8]">
                  Most pieces are created in my studio and ship internationally. Ready-to-ship
                  items typically arrive within 2 to 3 weeks. Commissioned work ships upon
                  completion. I handle packaging personally to ensure safe arrival.
                </p>
              </div>
              <div className="h-px bg-wood-100" />
              <div>
                <h4 className="font-sans text-lg text-wood-900 mb-2 font-medium">
                  What sizes are available?
                </h4>
                <p className="font-sans text-base text-wood-600 leading-[1.8]">
                  I work across all scales, from palm-sized talismans and jewelry to
                  room-filling installations. For commissions, size is part of the conversation.
                  For ready-to-ship pieces, dimensions are listed on each piece's page.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── General Contact ────────────────────────────────────────── */}
        <div className="mt-20 text-center">
          <a
            href="mailto:hello@adrianrasmussen.com"
            className="group inline-flex items-center gap-3 px-6 py-3 transition-all duration-300"
          >
            <span className="font-sans text-base text-wood-700 group-hover:text-wood-900 transition-colors">
              Just want to say hello?
            </span>
            <span className="w-6 h-px bg-wood-300 group-hover:bg-bronze-400 group-hover:w-8 transition-all duration-300" />
            <span className="font-label text-xs uppercase tracking-[0.15em] text-bronze-500 font-semibold group-hover:text-bronze-700 transition-colors">
              Email
            </span>
          </a>
        </div>

      </div>
    </section>
  );
};

export default Inquire;
