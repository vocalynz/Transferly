import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, Phone, MessageCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function HelpPage() {
  const { config } = useAppContext();
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-brand" style={{ color: '#f8812d' }}>
              {config.name}
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-brand/10 to-brand/5 py-16" style={{ backgroundImage: 'linear-gradient(to right, rgba(248, 129, 45, 0.1), rgba(248, 129, 45, 0.05))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4">
            <HelpCircle className="w-8 h-8 text-brand flex-shrink-0 mt-1" style={{ color: '#f8812d' }} />
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-4">Help & Support</h1>
              <p className="text-xl text-gray-600">
                Find answers to your questions and get support from our team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {config.helpFAQ.map((faq, index) => (
              <div
                key={faq.id}
                className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition"
              >
                <button
                  onClick={() =>
                    setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)
                  }
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg font-semibold text-gray-900 text-left">
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={20}
                    className="flex-shrink-0 transition-transform text-brand"
                    style={{
                      color: '#f8812d',
                      transform:
                        expandedFAQ === faq.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>

                {expandedFAQ === faq.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Get in Touch
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Email */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center hover:shadow-md transition">
              <div className="w-12 h-12 rounded-lg bg-brand/20 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(248, 129, 45, 0.2)' }}>
                <Mail className="text-brand" style={{ color: '#f8812d' }} size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Email</h3>
              <a
                href={`mailto:${config.email}`}
                className="text-brand hover:underline break-all"
                style={{ color: '#f8812d' }}
              >
                {config.email}
              </a>
            </div>

            {/* Phone */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center hover:shadow-md transition">
              <div className="w-12 h-12 rounded-lg bg-brand/20 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(248, 129, 45, 0.2)' }}>
                <Phone className="text-brand" style={{ color: '#f8812d' }} size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Phone</h3>
              <a
                href={`tel:${config.phone}`}
                className="text-brand hover:underline"
                style={{ color: '#f8812d' }}
              >
                {config.phone}
              </a>
            </div>

            {/* Telegram */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center hover:shadow-md transition">
              <div className="w-12 h-12 rounded-lg bg-brand/20 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(248, 129, 45, 0.2)' }}>
                <MessageCircle className="text-brand" style={{ color: '#f8812d' }} size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Telegram</h3>
              <a
                href={config.telegramSupportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-2 rounded-lg font-medium text-white transition"
                style={{ backgroundColor: '#f8812d' }}
              >
                Contact Support
              </a>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Address</h3>
            <p className="text-gray-600">{config.address}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 {config.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
