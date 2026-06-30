import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Zap, Globe } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function AboutPage() {
  const { config } = useAppContext();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-brand" style={{ color: '#f8812d' }}>
              {config.platform_name || 'Transferly'}
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
          <h1 className="text-5xl font-bold text-gray-900 mb-4">About {config.platform_name || 'Transferly'}</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            {config.tagline || 'Generate Professional Receipts Instantly'}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-lg max-w-none">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">
              {config.about_us}
            </p>

            {/* Values Section */}
            <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-6">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-8">
              {[
                {
                  icon: <Zap className="w-10 h-10" style={{ color: '#f8812d' }} />,
                  title: 'Speed',
                  description: 'Lightning-fast receipt generation to save you time',
                },
                {
                  icon: <Users className="w-10 h-10" style={{ color: '#f8812d' }} />,
                  title: 'Customer Focus',
                  description: 'Dedicated to providing exceptional support and service',
                },
                {
                  icon: <Globe className="w-10 h-10" style={{ color: '#f8812d' }} />,
                  title: 'Innovation',
                  description: 'Continuously improving our platform with new features',
                },
              ].map((value, idx) => (
                <div key={idx} className="text-center">
                  <div className="flex justify-center mb-4">{value.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600">{value.description}</p>
                </div>
              ))}
            </div>

            {/* Statistics */}
            <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-6">
              By The Numbers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-8">
              {[
                {
                  label: 'Active Users',
                  value: config.totalUsers.toLocaleString(),
                },
                {
                  label: 'Receipts Generated',
                  value: config.activities.toLocaleString(),
                },
                {
                  label: 'Emails Sent',
                  value: config.emailSent.toLocaleString(),
                },
              ].map((stat, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                  <p className="text-4xl font-bold mb-2" style={{ color: '#f8812d' }}>
                    {stat.value}
                  </p>
                  <p className="text-gray-600">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Contact */}
            <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-6">
              Get In Touch
            </h2>
            <div className="bg-gray-50 rounded-lg p-8 border border-gray-200 my-8">
              <p className="text-gray-700 mb-4">
                Have questions? We'd love to hear from you. Reach out to our team:
              </p>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <span className="font-semibold">Email:</span> {config.email}
                </li>
                <li>
                  <span className="font-semibold">Phone:</span> {config.phone}
                </li>
                <li>
                  <span className="font-semibold">Address:</span> {config.address}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 {config.platform_name || 'Transferly'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
