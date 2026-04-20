import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '📸',
    title: 'Private & Secure',
    desc: 'Your family memories stay private. You control who sees what, down to each individual child.',
  },
  {
    icon: '🎬',
    title: 'Memory Reels',
    desc: 'Auto-generated slideshows from your best moments — annual, monthly, or by special occasion.',
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Loved One Access',
    desc: 'Invite grandparents and relatives with per-child, per-permission access control.',
  },
  {
    icon: '🎂',
    title: 'Age Labels',
    desc: 'Every memory automatically shows how old each child was — "2 years, 3 months".',
  },
  {
    icon: '📱',
    title: 'Mobile First',
    desc: 'Upload from any device. Drag, drop, or capture directly.',
  },
  {
    icon: '🔒',
    title: 'Classified Memories',
    desc: 'Mark sensitive memories as parent-only — hidden from all loved ones. (Premium)',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    color: 'border-gray-200',
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
    color: 'border-brand-400 ring-2 ring-brand-300',
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
    color: 'border-amber-300',
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center text-white text-sm font-bold">
            OSF
          </div>
          <span className="font-bold text-gray-900 text-lg">Our Sweet Family</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Sign in
          </Link>
          <Link to="/signup" className="btn-primary text-sm">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <span>Private family sharing</span>
          <span className="text-brand-400">•</span>
          <span>Zero ads. Full privacy.</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Every precious moment,{' '}
          <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
            safe forever.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          A private, beautiful home for your children's photos and videos. Share with family you trust,
          with full control over who sees what.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup" className="btn-primary text-base px-8 py-3">
            Start for free — no card needed
          </Link>
          <Link to="/login" className="btn-secondary text-base px-8 py-3">
            Sign in
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">No credit card required for Free plan.</p>

        {/* Hero image mockup */}
        <div className="mt-16 relative">
          <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl p-4 md:p-8 max-w-4xl mx-auto shadow-2xl">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">A</div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">The Johnson Family</p>
                  <p className="text-xs text-gray-500">3 children • 5 loved ones</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=300',
                  'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=300',
                  'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300',
                  'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=300',
                  'https://images.unsplash.com/photo-1489710437720-ebb67ec84dd2?w=300',
                  'https://images.unsplash.com/photo-1529698657625-c83b3f905726?w=300',
                ].map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-200">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                      {i === 0 ? '1y 5m' : i === 1 ? '1y' : i === 2 ? '4m' : i === 3 ? '3y' : i === 4 ? '1y 8m' : '4y 2m'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything your family memories deserve</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Built for parents who want a real home for their children's stories — not just another social feed.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-16 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, honest pricing</h2>
          <p className="text-gray-600">Start free. Upgrade when you're ready.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div key={plan.name} className={`card p-6 flex flex-col relative ${plan.color}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-bold text-lg text-gray-900 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
      </section>

      {/* CTA */}
      <section className="px-6 py-16 bg-gradient-to-br from-brand-500 to-brand-700 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Start saving your family's memories today</h2>
        <p className="text-brand-100 mb-8 max-w-md mx-auto">Free forever. No ads. No selling your data. Just your family.</p>
        <Link to="/signup" className="inline-block bg-white text-brand-600 font-bold px-8 py-3 rounded-xl hover:bg-brand-50 transition-colors">
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-gray-400 text-sm border-t border-gray-100">
        <p>&copy; 2025 Our Sweet Family. All rights reserved. Built with love.</p>
      </footer>
    </div>
  );
}
