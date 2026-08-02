import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', company: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      await api.post('/contact', form);
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '', company: '' });
    } catch (err) {
      setStatus('error');
      setError(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        'Something went wrong. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Our Sweet Family" className="w-10 h-10" />
          <span className="font-bold text-gray-900 text-lg">Our Sweet Family</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Sign in
          </Link>
          <Link to="/signup" className="btn-primary text-sm">Get started free</Link>
        </div>
      </nav>

      <section className="px-6 py-12 md:py-16 max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Contact us</h1>
          <p className="text-gray-600">
            Questions, feedback, or need a hand? Send us a message and we'll get back to you.
          </p>
        </div>

        <div className="card p-6 md:p-8">
          {status === 'sent' ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Message sent!</h2>
              <p className="text-gray-500 text-sm mb-6">Thanks for reaching out. We'll reply to your email soon.</p>
              <button onClick={() => setStatus('idle')} className="btn-secondary text-sm">Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {/* Honeypot: hidden from real users; bots that fill it are dropped server-side */}
              <input
                type="text"
                name="company"
                value={form.company}
                onChange={update('company')}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
                <input type="text" className="input" value={form.name} onChange={update('name')} placeholder="Alex Johnson" required maxLength={200} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" className="input" value={form.email} onChange={update('email')} placeholder="you@example.com" required autoComplete="email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" className="input" value={form.subject} onChange={update('subject')} placeholder="What's this about?" maxLength={300} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                <textarea className="input min-h-[140px] resize-y" value={form.message} onChange={update('message')} placeholder="How can we help?" required maxLength={5000} />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending...' : 'Send message'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Or email us directly at{' '}
                <a href="mailto:Contact@oursweetfamily.com" className="text-brand-600 hover:underline">
                  Contact@oursweetfamily.com
                </a>
              </p>
            </form>
          )}
        </div>

        <p className="text-center mt-6">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">← Back to home</Link>
        </p>
      </section>
    </div>
  );
}
