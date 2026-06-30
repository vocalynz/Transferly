import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAppContext } from '../context/AppContext';
import ServiceLogo from '../components/ServiceLogo';
import { getServiceBySlug, getServicesByGroup, serviceGroups } from '../lib/servicesCatalog';

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-200 text-slate-700',
    orange: 'bg-orange-100 text-orange-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700'
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function badgeTone(label) {
  if (label === 'Live') {
    return 'emerald';
  }
  if (label === 'New' || label === 'Soon') {
    return 'orange';
  }
  if (label === 'Popular') {
    return 'blue';
  }
  return 'slate';
}

export default function ServicesPage() {
  const { config, profile } = useAppContext();
  const brand = config?.brand_color || '#f8812d';
  const aiReply = getServiceBySlug('ai-reply');
  const scriptsGroup = serviceGroups.find((group) => group.title === 'Template Marketplace');
  const standardGroups = serviceGroups.filter((group) => group.title !== 'Template Marketplace');
  const scriptService = scriptsGroup ? getServicesByGroup(scriptsGroup)[0] : null;

  return (
    <DashboardLayout>
      <div className="space-y-8 px-4 py-5 md:px-8 md:py-8">
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 md:text-4xl">Services</h1>
            <Link
              to="/buy-point"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
              style={{ backgroundColor: brand }}
            >
              Buy Points
            </Link>
          </div>

          {aiReply ? (
            <Link
              to={`/services/${aiReply.slug}`}
              className="group flex items-center justify-between gap-5 rounded-[28px] bg-[#121212] p-6 text-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] transition hover:translate-y-[-1px]"
            >
              <div className="flex items-start gap-4">
                <ServiceLogo service={aiReply} size="lg" />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-[-0.04em]">{aiReply.title}</h2>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-200">
                      {aiReply.badge}
                    </span>
                  </div>
                  <p className="max-w-3xl text-sm leading-7 text-white/72">{aiReply.description}</p>
                </div>
              </div>
              <ArrowRight size={20} className="shrink-0 text-white/45 transition group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          ) : null}
        </section>

        <div className="space-y-5">
          {standardGroups.map((group) => {
            const services = getServicesByGroup(group);

            return (
              <section
                key={group.title}
                className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Badge tone={group.title === 'Verified Notifications' ? 'orange' : 'slate'}>{group.title}</Badge>
                  </div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">{group.title}</h2>
                </div>

                <div className={`mt-5 grid gap-3 ${group.title === 'Verified Notifications' ? 'md:grid-cols-2 xl:grid-cols-3' : group.title === 'Featured' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3'}`}>
                  {services.map((service) => (
                    <Link
                      key={service.slug}
                      to={`/services/${service.slug}`}
                      className="group flex items-center justify-between rounded-[22px] border border-slate-200 bg-[#f8f7f3] px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50/60"
                    >
                      <div className="flex items-center gap-4">
                        <ServiceLogo service={service} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-slate-950">{service.title}</p>
                          {service.badge !== 'Popular' && service.badge !== 'Live' && service.badge !== 'Utility' && service.badge !== 'Suite' ? (
                            <div className="mt-1">
                              <Badge tone={badgeTone(service.badge)}>{service.badge}</Badge>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {scriptService ? (
            <section className="rounded-[26px] border border-[#ece7dd] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <Sparkles size={14} />
                    Templates
                  </div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950">Template Marketplace</h2>
                </div>
                <Link to={scriptService.launchTo} className="text-sm font-black text-slate-700 transition hover:text-slate-950">
                  Open Marketplace
                </Link>
              </div>

              <Link
                to={`/services/${scriptService.slug}`}
                className="mt-5 grid gap-5 rounded-[24px] border border-[#ece7dd] bg-[#f8f7f3] p-5 transition hover:border-orange-200 hover:bg-orange-50/50 md:grid-cols-[220px_minmax(0,1fr)]"
              >
                <div className="flex min-h-[160px] items-center justify-center rounded-[22px] bg-[#121212] p-6">
                  <ServiceLogo service={scriptService} size="lg" />
                </div>
                <div className="flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-950">{scriptService.title}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{scriptService.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
                      Premium
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Ops-ready
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-black text-slate-700">
                      View Details
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
