import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import LogoMark from '../components/LogoMark';

const features = [
  {
    icon: '📸',
    title: 'Private & Secure',
    desc: 'Your family memories stay private. You control who sees what, down to each individual child.',
    accent: 'brand',
  },
  {
    icon: '🎬',
    title: 'Memory Reels',
    desc: 'Auto-generated slideshows from your best moments — annual, monthly, or by special occasion.',
    accent: 'blue',
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Loved One Access',
    desc: 'Invite grandparents and relatives with per-child, per-permission access control.',
    accent: 'sun',
  },
  {
    icon: '🎂',
    title: 'Age Labels',
    desc: 'Every memory automatically shows how old each child was — "2 years, 3 months".',
    accent: 'brand',
  },
  {
    icon: '📱',
    title: 'Mobile First',
    desc: 'Upload from any device. Drag, drop, or capture directly.',
    accent: 'blue',
  },
  {
    icon: '🔒',
    title: 'Classified Memories',
    desc: 'Mark sensitive memories as parent-only — hidden from all loved ones. (Premium)',
    accent: 'sun',
  },
];

const accentRing = {
  brand: 'bg-brand-50 text-brand-600',
  blue: 'bg-blue-50 text-blue-600',
  sun: 'bg-sun-50 text-sun-600',
};

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    color: 'border-black/5',
    badge: null,
    features: [
      'Unlimited photo uploads (compressed)',
      'Up to 20GB video storage',
      'Unlimited children',
      'Invite loved ones with access control',
      'Annual Memory Reel',
      'Age labels on memories',
      'Comments & reactions',
    ],
    cta: 'Get started free',
    href: '/signup',
    primary: false,
  },
  {
    name: 'Plus',
    price: '$6',
    period: '/month',
    color: 'border-brand-300 ring-2 ring-brand-200',
    badge: 'Most popular',
    features: [
      'Everything in Free',
      '200GB video storage',
      'Unlimited HD / original photos',
      'Monthly Memory Reels',
      'Child milestones tracker',
      'Export & download originals',
    ],
    cta: 'Start Plus',
    href: '/signup?plan=plus',
    primary: true,
  },
  {
    name: 'Premium',
    price: '$14',
    period: '/month',
    color: 'border-blue-200',
    badge: null,
    features: [
      'Everything in Plus',
      'Unlimited video storage',
      'Monthly, Yearly, Birthday & Holiday Reels',
      'AI facial recognition & auto-tagging',
      'Device camera roll auto-upload',
      'Classified (parent-only) memories',
    ],
    cta: 'Start Premium',
    href: '/signup?plan=premium',
    primary: false,
  },
];

const faqs = [
  {
    q: 'How is this different from iCloud or Google Photos?',
    a: "Our Sweet Family is built for sharing kids' memories with the people who love them — not for backing up your whole camera roll. You invite specific loved ones and control exactly which children and memories each person sees, every photo shows how old your child was, and there are never any ads or data-mining.",
  },
  {
    q: 'Is it really private?',
    a: "Yes. Photos and videos are stored privately and are only ever served to people you've invited to your family, after an access check. There are no public links, no ads, and we never sell your data.",
  },
  {
    q: 'Can grandparents and relatives use it easily?',
    a: 'Absolutely. You send a simple invite link; they create an account and instantly see the memories you’ve shared. You choose per person which children and memories they can view.',
  },
  {
    q: 'What happens to my photos if I stop using it?',
    a: 'Your memories are yours. Paid plans let you export and download your originals at any time, and you can delete your data whenever you want.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-paper/80 border-b border-black/5">
        <div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
          <Logo tone="brand" wordmark="script" size={52} />
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hidden sm:inline text-sm font-medium text-ink-soft hover:text-ink transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hidden sm:inline text-sm font-medium text-ink-soft hover:text-ink transition-colors">
              FAQ
            </a>
            <a href="/blog" className="hidden sm:inline text-sm font-medium text-ink-soft hover:text-ink transition-colors">
              Blog
            </a>
            <Link to="/login" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link to="/signup" className="btn-primary text-sm">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — text-forward, with a floating live-activity card */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-sunrise opacity-90" />
        <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-brand-300/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-blue-300/40 blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-24 md:pt-20 md:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur text-ink rounded-full px-4 py-1.5 text-sm font-medium mb-6 shadow-soft">
                <span>Private family sharing</span>
                <span className="text-brand-500">•</span>
                <span>Zero ads. Full privacy.</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold text-ink leading-[1.02] tracking-tight mb-5">
                Hold onto{' '}
                <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-sun-400 bg-clip-text text-transparent">
                  every little
                </span>{' '}
                moment.
              </h1>
              <p className="text-lg md:text-xl text-ink-soft max-w-md mb-8 leading-relaxed">
                A calm, private home for your kids' photos and videos — no ads, no strangers, just the
                people who love them.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/signup" className="btn-primary text-base px-7 py-3">
                  Create your family
                </Link>
                <a
                  href="#tour"
                  className="inline-flex items-center gap-2 bg-white/70 backdrop-blur text-ink font-semibold px-7 py-3 rounded-full border border-white/70 shadow-soft hover:bg-white transition-colors"
                >
                  <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 3.7A1 1 0 004.8 4.6v10.8a1 1 0 001.5.86l9-5.4a1 1 0 000-1.72l-9-5.4z" />
                  </svg>
                  Watch the film
                </a>
              </div>
              <p className="text-sm text-ink-muted mt-4">No credit card required for the Free plan.</p>
            </div>

            {/* Floating preview + live-activity card */}
            <div className="relative min-h-[340px] flex justify-center lg:justify-end">
              <div className="card-glass p-3 w-full max-w-sm rotate-1">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-brand-50">
                  <img src="/hero/tile-1.webp" alt="Family memory" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 bg-ink/60 text-white text-xs px-2 py-0.5 rounded-md backdrop-blur-sm">
                    1y 5m
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 px-1 pb-1">
                  <span className="w-9 h-9 rounded-xl bg-white shadow-soft flex items-center justify-center overflow-hidden">
                    <img src="/brand/osf-4-circle-badge-sunrise.svg" alt="Our Sweet Family" className="w-full h-full object-contain" />
                  </span>
                  <span className="text-sm font-semibold text-ink-soft">
                    Mom added 4 memories · <span className="text-brand-600">just now</span>
                  </span>
                </div>
              </div>
              {/* small stacked card for depth */}
              <div className="hidden sm:block absolute -bottom-6 -left-2 lg:left-6 card-glass p-2.5 w-40 -rotate-3">
                <div className="rounded-xl overflow-hidden aspect-square bg-blue-50">
                  <img src="/hero/tile-4.webp" alt="" className="w-full h-full object-cover" />
                </div>
                <p className="text-[11px] font-semibold text-ink-soft mt-2 px-0.5">Grandma reacted ❤️</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product tour — "finally inside the app" */}
      <section id="tour" className="px-6 py-20 bg-paper">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-brand-600 mb-3">A calm place to look back</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-ink tracking-tight">Your family's whole story, in one warm feed</h2>
          </div>
          {/* Browser mockup */}
          <div className="rounded-3xl overflow-hidden border border-black/5 shadow-soft bg-white max-w-4xl mx-auto">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-black/5">
              <span className="w-3 h-3 rounded-full bg-[#ff6058]" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-ink-muted bg-paper px-3 py-1 rounded-full flex-1 max-w-xs">oursweetfamily.com/timeline</span>
            </div>
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <img src="/brand/osf-4-circle-badge-sunrise.svg" alt="Our Sweet Family" className="w-11 h-11 object-contain" />
                  <span className="font-extrabold text-xl text-ink tracking-tight">The Quiery Family</span>
                </div>
                <span className="text-xs font-bold text-white bg-gradient-to-r from-brand-500 to-sun-400 px-3.5 py-1.5 rounded-full">Today</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden aspect-[4/3] bg-brand-50">
                  <img src="/hero/tile-2.webp" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="rounded-2xl overflow-hidden aspect-square bg-blue-50"><img src="/hero/tile-3.webp" alt="" className="w-full h-full object-cover" /></div>
                <div className="rounded-2xl overflow-hidden aspect-square bg-sun-50"><img src="/hero/tile-5.webp" alt="" className="w-full h-full object-cover" /></div>
                <div className="rounded-2xl overflow-hidden aspect-square bg-brand-50"><img src="/hero/tile-6.webp" alt="" className="w-full h-full object-cover" /></div>
                <div className="rounded-2xl overflow-hidden aspect-square bg-blue-50"><img src="/hero/tile-4.webp" alt="" className="w-full h-full object-cover" /></div>
              </div>
            </div>
          </div>
          <p className="text-center text-ink-soft text-sm mt-6 max-w-xl mx-auto">
            The same heart leads the app, the phone, and the tab bar — so it finally wears the identity the website always had.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 bg-paper">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-ink mb-4 tracking-tight">Everything your family memories deserve</h2>
            <p className="text-ink-soft max-w-xl mx-auto">Built for parents who want a real home for their children's stories — not just another social feed.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 ${accentRing[f.accent]}`}>{f.icon}</div>
                <h3 className="font-bold text-ink mb-2">{f.title}</h3>
                <p className="text-ink-soft text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 bg-sunrise-soft">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-ink mb-4 tracking-tight">Simple, honest pricing</h2>
            <p className="text-ink-soft">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.name} className={`card p-6 flex flex-col relative ${plan.color} ${plan.primary ? 'shadow-glow' : ''}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-glow">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-bold text-lg text-ink mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-ink">{plan.price}</span>
                    <span className="text-ink-muted text-sm">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                      <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  className={plan.primary ? 'btn-primary text-center text-sm' : 'btn-secondary text-center text-sm'}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 bg-paper">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-ink mb-4 tracking-tight">Frequently asked questions</h2>
            <p className="text-ink-soft">Everything you need to know before you start.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="card p-5 group">
                <summary className="flex items-center justify-between gap-4 cursor-pointer font-semibold text-ink list-none">
                  {f.q}
                  <svg className="w-5 h-5 text-brand-400 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-ink-soft text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden bg-sunrise px-6 py-16 text-center shadow-soft">
          <div className="absolute -top-16 -left-10 w-72 h-72 rounded-full bg-white/40 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex justify-center mb-5">
              <LogoMark heart="#ef3f74" fig="#232a45" size={104} />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-ink mb-4 tracking-tight">Start saving your family's memories today</h2>
            <p className="text-ink-soft mb-8 max-w-md mx-auto">Free forever. No ads. No selling your data. Just your family.</p>
            <Link to="/signup" className="btn-primary inline-block text-base px-8 py-3">
              Create your free account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center text-ink-muted text-sm border-t border-black/5 bg-paper">
        <div className="flex items-center justify-center mb-4">
          <Logo tone="ink" wordmark="script" size={48} />
        </div>
        <div className="flex items-center justify-center gap-4 mb-3">
          <Link to="/contact" className="text-ink-soft hover:text-brand-600 transition-colors">Contact us</Link>
          <a href="/blog" className="text-ink-soft hover:text-brand-600 transition-colors">Blog</a>
          <Link to="/privacy" className="text-ink-soft hover:text-brand-600 transition-colors">Privacy</Link>
          <Link to="/login" className="text-ink-soft hover:text-brand-600 transition-colors">Sign in</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} Our Sweet Family. All rights reserved. Built with love.</p>
      </footer>
    </div>
  );
}
