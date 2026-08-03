import React from 'react';
import { Link } from 'react-router-dom';

// Simple, readable privacy policy. Written to match how the app actually works:
// private media, Clerk-managed auth, no ads, no data selling.
function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-gray-600 leading-relaxed text-sm">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Our Sweet Family" className="w-9 h-9" />
          <span className="font-bold text-gray-900">Our Sweet Family</span>
        </Link>
        <Link to="/signup" className="btn-primary text-sm">Get started free</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: August 3, 2026</p>

        <Section title="The short version">
          <p>
            Our Sweet Family is a private place for your family's photos and videos. We don't run ads,
            we don't sell your data, and your memories are only ever shown to the people you personally
            invite. This page explains what we collect and why, in plain language.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            <strong>Account information:</strong> your name and email address, so you can sign in and we
            can send account and invitation emails.
          </p>
          <p>
            <strong>Your content:</strong> the photos, videos, captions, children's names and birthdates,
            and comments you add. This is the content the service exists to store for you.
          </p>
          <p>
            <strong>Basic usage data:</strong> privacy-friendly, aggregate analytics (such as page views)
            to understand how the site is used. This does not build advertising profiles.
          </p>
        </Section>

        <Section title="Who can see your photos">
          <p>
            Your photos and videos are stored privately and are <strong>never public</strong>. There are
            no shareable public links. Media is served only through an access-controlled connection, and
            only to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>you (the account owner), and</li>
            <li>the specific loved ones you invite to your family.</li>
          </ul>
          <p>
            For each invited person, you control which children and which memories they can see. Members
            of one family can never access another family's content.
          </p>
        </Section>

        <Section title="How we use your information">
          <p>
            We use your information solely to provide the service: to store and display your memories, to
            authenticate you, to send invitations and account emails you request, and to maintain and
            improve the product. We do <strong>not</strong> sell your personal information or your content,
            and we do <strong>not</strong> use it for advertising.
          </p>
        </Section>

        <Section title="Children's information">
          <p>
            Our Sweet Family is intended for use by <strong>parents and adult family members</strong>, not
            by children. Any information about a child is provided and controlled by the parent or guardian
            who owns the account. You can edit or delete your children's information at any time from the
            Children page.
          </p>
        </Section>

        <Section title="Service providers we rely on">
          <p>We use a small number of trusted providers to run the service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Authentication</strong> — a dedicated identity provider (Clerk) manages sign-in and passwords; we never store your password ourselves.</li>
            <li><strong>Hosting &amp; storage</strong> — your account data and media are hosted with reputable cloud infrastructure providers, with media kept in private storage.</li>
            <li><strong>Email delivery</strong> — a transactional email provider (Resend) delivers invitation and account emails.</li>
          </ul>
          <p>These providers process data only to perform their function for us.</p>
        </Section>

        <Section title="Cookies">
          <p>
            We use only the cookies necessary to keep you securely signed in. We do not use advertising or
            cross-site tracking cookies.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <p>
            You can view and update your account and children's information at any time. Paid plans let you
            export and download your original files. You can delete individual memories, or request deletion
            of your account and associated data, by contacting us.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep your content for as long as your account is active. When you delete content — or your
            account — it is removed from the service, and the underlying files are deleted from storage.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make material changes to this policy, we'll update the date above and, where appropriate,
            notify you by email.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about your privacy? Email us at{' '}
            <a href="mailto:contact@oursweetfamily.com" className="text-brand-600 hover:text-brand-700 font-medium">
              contact@oursweetfamily.com
            </a>{' '}
            or use our{' '}
            <Link to="/contact" className="text-brand-600 hover:text-brand-700 font-medium">contact form</Link>.
          </p>
        </Section>

        <div className="pt-6 border-t border-gray-100">
          <Link to="/" className="text-sm text-gray-500 hover:text-brand-600">← Back to home</Link>
        </div>
      </main>
    </div>
  );
}
