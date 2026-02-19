
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

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
  '$1,000 – $5,000',
  '$5,000 – $15,000',
  '$15,000 – $50,000',
  '$50,000+',
  'Let\'s discuss',
];

const TIMELINE_OPTIONS = [
  'Flexible / No rush',
  'Within 3 months',
  'Within 6 months',
  'Within a year',
  'Specific date – I\'ll mention in my message',
];

const REFERRAL_OPTIONS = [
  'Word of mouth',
  'Instagram',
  'Saw a piece in person',
  'Writings / Blog',
  'Burning Man or festival',
  'Other',
];

const Inquire: React.FC = () => {
  const [commissionType, setCommissionType] = useState<CommissionType>('personal');
  const [showOptionals, setShowOptionals] = useState(false);
  const [showLightCodes, setShowLightCodes] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    vision: '',
    commissionType: 'personal',
    budget: '',
    timeline: '',
    referral: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCommissionType = (type: CommissionType) => {
    setCommissionType(type);
    setForm(prev => ({ ...prev, commissionType: type }));
  };

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
    setSendStatus('IDLE');
    setErrorMsg('');
    setForm({ name: '', email: '', vision: '', commissionType: 'personal', budget: '', timeline: '', referral: '' });
    setCommissionType('personal');
    setShowOptionals(false);
  };

  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-20">

      {/* 9.1 Hero */}
      <div className="max-w-[1400px] mx-auto px-6 mb-24">
          <div className="flex flex-col md:flex-row gap-1">
              <div className="flex-1 h-[400px] md:h-[600px] bg-wood-100 relative overflow-hidden">
                  <img src="https://picsum.photos/1000/1200?random=inq1" className="w-full h-full object-cover grayscale" alt="Intimate Piece" />
                  <div className="absolute bottom-6 left-6 bg-paper-50/90 px-4 py-2 font-mono text-[10px] uppercase tracking-widest font-bold">Personal</div>
              </div>
              <div className="flex-1 h-[400px] md:h-[600px] bg-wood-100 relative overflow-hidden">
                  <img src="https://picsum.photos/1200/1000?random=inq2" className="w-full h-full object-cover grayscale" alt="Large Installation" />
                  <div className="absolute bottom-6 left-6 bg-paper-50/90 px-4 py-2 font-mono text-[10px] uppercase tracking-widest font-bold">Spatial</div>
              </div>
          </div>
      </div>

      <div className="max-w-3xl mx-auto px-6">

          {/* 9.2 Opening */}
          <div className="mb-16">
               <h1 className="font-serif text-5xl text-wood-900 mb-8 font-medium">Inquire</h1>
               <p className="font-serif text-xl text-wood-700 leading-relaxed font-light mb-6">
                  I take on a small number of commissions each year. Some become intimate pieces for personal spaces. Others become installations that transform environments.
               </p>
               <p className="font-serif text-lg text-wood-600 leading-relaxed">
                  I'm selective. Not because of budget, but because of fit. The right projects find me, and I recognize them when they do. If you're feeling a pull toward working together, trust that.
               </p>
          </div>

          {/* 9.3 Commission Paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
               <div className="bg-white p-8 border border-wood-200">
                   <h3 className="font-serif text-2xl text-wood-900 mb-3 font-medium">Personal Commissions</h3>
                   <p className="font-serif text-wood-600 mb-4">Something for your home, your altar, your life. Pieces created from conversation.</p>
               </div>
               <div className="bg-white p-8 border border-wood-200">
                   <h3 className="font-serif text-2xl text-wood-900 mb-3 font-medium">Spatial Commissions</h3>
                   <p className="font-serif text-wood-600 mb-4">Installations. Tea houses. Stages. Spaces where people can gather and connect.</p>
               </div>
          </div>

          {/* 9.4 Form */}
          <div className="bg-wood-50 p-8 md:p-12 border border-wood-100 relative">
               <h3 className="font-serif text-3xl text-wood-900 mb-8 font-medium">Start the conversation</h3>

               {submitted ? (
                 /* Success State */
                 <div className="text-center py-12">
                   <CheckCircle className="mx-auto mb-6 text-bronze-600" size={48} strokeWidth={1.5} />
                   <h4 className="font-serif text-2xl text-wood-900 mb-4 font-medium">Transmission received.</h4>
                   <p className="font-serif text-wood-600 leading-relaxed mb-8">
                     Thank you for reaching out. I read every message personally and respond to those where I feel alignment. You'll hear from me if the fit is right.
                   </p>
                   <button
                     onClick={handleReset}
                     className="font-mono text-xs uppercase tracking-widest text-wood-500 border-b border-wood-300 pb-1 hover:text-wood-900 hover:border-wood-900 transition-colors"
                   >
                     Send another message
                   </button>
                 </div>
               ) : (
                 <form className="space-y-8" onSubmit={handleSubmit}>

                   {/* Commission Type Toggle */}
                   <div className="space-y-2">
                     <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold block">Type of Commission</label>
                     <div className="flex gap-0 border border-wood-300 w-fit">
                       <button
                         type="button"
                         onClick={() => handleCommissionType('personal')}
                         className={`px-6 py-3 font-mono text-xs uppercase tracking-widest font-bold transition-colors ${
                           commissionType === 'personal'
                             ? 'bg-wood-900 text-paper-50'
                             : 'bg-transparent text-wood-500 hover:text-wood-900'
                         }`}
                       >
                         Personal
                       </button>
                       <button
                         type="button"
                         onClick={() => handleCommissionType('spatial')}
                         className={`px-6 py-3 font-mono text-xs uppercase tracking-widest font-bold transition-colors border-l border-wood-300 ${
                           commissionType === 'spatial'
                             ? 'bg-wood-900 text-paper-50'
                             : 'bg-transparent text-wood-500 hover:text-wood-900'
                         }`}
                       >
                         Spatial
                       </button>
                     </div>
                     <p className="font-serif text-sm text-wood-500 italic">
                       {commissionType === 'personal'
                         ? 'Pieces for your home, altar, or personal space.'
                         : 'Installations, tea houses, stages, and gathering environments.'}
                     </p>
                   </div>

                   {/* Name + Email */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">Name</label>
                            <input
                              type="text"
                              name="name"
                              value={form.name}
                              onChange={handleChange}
                              className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg"
                              required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">Email</label>
                            <input
                              type="email"
                              name="email"
                              value={form.email}
                              onChange={handleChange}
                              className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg"
                              required
                            />
                        </div>
                   </div>

                   {/* Vision */}
                   <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">What wants to exist?</label>
                        <textarea
                          name="vision"
                          rows={4}
                          value={form.vision}
                          onChange={handleChange}
                          className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg resize-none"
                          placeholder="Tell me what you're imagining..."
                          required
                        />
                   </div>

                   {/* Collapsible Optionals */}
                   <div className="border-t border-wood-200 pt-6">
                     <button
                       type="button"
                       onClick={() => setShowOptionals(prev => !prev)}
                       className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-wood-500 hover:text-wood-900 transition-colors font-bold"
                     >
                       {showOptionals ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                       {showOptionals ? 'Fewer details' : 'Add more detail (optional)'}
                     </button>

                     {showOptionals && (
                       <div className="mt-8 space-y-8">
                         {/* Budget */}
                         <div className="space-y-2">
                           <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">Budget Range</label>
                           <select
                             name="budget"
                             value={form.budget}
                             onChange={handleChange}
                             className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg appearance-none cursor-pointer"
                           >
                             <option value="">Select a range…</option>
                             {BUDGET_OPTIONS.map(opt => (
                               <option key={opt} value={opt}>{opt}</option>
                             ))}
                           </select>
                         </div>

                         {/* Timeline */}
                         <div className="space-y-2">
                           <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">Timeline</label>
                           <select
                             name="timeline"
                             value={form.timeline}
                             onChange={handleChange}
                             className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg appearance-none cursor-pointer"
                           >
                             <option value="">Select a timeline…</option>
                             {TIMELINE_OPTIONS.map(opt => (
                               <option key={opt} value={opt}>{opt}</option>
                             ))}
                           </select>
                         </div>

                         {/* Referral */}
                         <div className="space-y-2">
                           <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">How did you find me?</label>
                           <select
                             name="referral"
                             value={form.referral}
                             onChange={handleChange}
                             className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg appearance-none cursor-pointer"
                           >
                             <option value="">Select one…</option>
                             {REFERRAL_OPTIONS.map(opt => (
                               <option key={opt} value={opt}>{opt}</option>
                             ))}
                           </select>
                         </div>
                       </div>
                     )}
                   </div>

                   {sendStatus === 'ERROR' && (
                     <div className="flex items-start gap-3 p-4 border border-wood-300 bg-white text-wood-700">
                       <AlertCircle size={16} className="shrink-0 mt-0.5 text-wood-500" />
                       <p className="font-serif text-sm">{errorMsg}</p>
                     </div>
                   )}

                   <div className="flex justify-end pt-4">
                        <button
                          type="submit"
                          disabled={sendStatus === 'SENDING'}
                          className="flex items-center gap-3 px-10 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-widest hover:bg-bronze-600 transition-colors font-bold shadow-lg disabled:opacity-60 disabled:cursor-wait"
                        >
                          {sendStatus === 'SENDING' ? (
                            <span className="animate-pulse">Sending...</span>
                          ) : (
                            <>Send Transmission <ArrowRight size={14} /></>
                          )}
                        </button>
                   </div>
               </form>
               )}
          </div>

          {/* 9.5 Below Form – Light Codes */}
          <div className="mt-12 text-center">
              <p className="font-serif text-wood-600">
                  Light Codes can also be created for you.{' '}
                  <button
                    onClick={() => setShowLightCodes(prev => !prev)}
                    className="text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
                  >
                    {showLightCodes ? 'Close' : 'Learn more'}
                  </button>
              </p>

              {showLightCodes && (
                <div className="mt-8 bg-white border border-wood-200 p-8 text-left">
                  <h4 className="font-serif text-2xl text-wood-900 mb-4 font-medium">Light Codes</h4>
                  <p className="font-serif text-wood-600 leading-relaxed mb-4">
                    Light Codes are channeled geometric transmissions — unique to you, your frequency, your intention. Rather than a traditional commission based on imagery or space, a Light Code begins with a conversation about what you're calling in.
                  </p>
                  <p className="font-serif text-wood-600 leading-relaxed mb-4">
                    Each one is laser-etched into basswood and finished by hand. They function as anchors — visual reminders of a frequency you want to embody. Collectors report that hanging a Light Code in a space changes the quality of that space.
                  </p>
                  <p className="font-serif text-wood-500 italic text-sm leading-relaxed">
                    If this resonates, mention it in your message above. I'll know what to do with it.
                  </p>
                </div>
              )}
          </div>

      </div>
    </section>
  );
};

export default Inquire;
