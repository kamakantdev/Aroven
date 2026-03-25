import Link from 'next/link';
import {
  Stethoscope,
  Building2,
  Pill,
  Shield,
  Building,
  Microscope,
  ArrowRight,
  Heart
} from 'lucide-react';

const PORTALS = [
  {
    id: 'admin',
    title: 'Admin',
    description: 'Platform control & approvals',
    icon: Shield,
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    borderColor: 'border-blue-200',
  },
  {
    id: 'doctor',
    title: 'Doctor',
    description: 'Clinical practice management',
    icon: Stethoscope,
    color: 'bg-emerald-600',
    hoverColor: 'hover:bg-emerald-700',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'hospital',
    title: 'Hospital',
    description: 'Operations & departments',
    icon: Building2,
    color: 'bg-teal-600',
    hoverColor: 'hover:bg-teal-700',
    borderColor: 'border-teal-200',
  },
  {
    id: 'clinic',
    title: 'Clinic',
    description: 'Appointments & scheduling',
    icon: Building,
    color: 'bg-pink-600',
    hoverColor: 'hover:bg-pink-700',
    borderColor: 'border-pink-200',
  },
  {
    id: 'diagnostic-center',
    title: 'Diagnostic Center',
    description: 'Tests, results & reports',
    icon: Microscope,
    color: 'bg-purple-600',
    hoverColor: 'hover:bg-purple-700',
    borderColor: 'border-purple-200',
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy',
    description: 'Prescriptions & inventory',
    icon: Pill,
    color: 'bg-orange-600',
    hoverColor: 'hover:bg-orange-700',
    borderColor: 'border-orange-200',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">SWASTIK</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Healthcare Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Healthcare Management Portal
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Select your role to access your dedicated dashboard. Each portal is designed for your specific workflow.
            </p>
          </div>

          {/* Portal Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PORTALS.map((portal) => {
              const Icon = portal.icon;
              return (
                <Link
                  key={portal.id}
                  href={`/login/${portal.id}`}
                  className={`group relative bg-white dark:bg-gray-900 rounded-2xl border-2 ${portal.borderColor} dark:border-gray-700 p-6 transition-all hover:shadow-xl hover:-translate-y-1`}
                >
                  <div className={`inline-flex p-3 rounded-xl ${portal.color} text-white mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {portal.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {portal.description}
                  </p>
                  <div className={`inline-flex items-center gap-2 text-sm font-medium ${portal.color.replace('bg-', 'text-').replace('-600', '-700')}`}>
                    <span>Login</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 mt-12 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} Swastik Healthcare. All rights reserved.</p>
          <p className="mt-2">
            <span className="hover:text-gray-700 dark:text-gray-300 cursor-default">Privacy Policy</span>
            {' · '}
            <span className="hover:text-gray-700 dark:text-gray-300 cursor-default">Terms of Service</span>
            {' · '}
            <a href="mailto:support@swastik.health" className="hover:text-gray-700 dark:text-gray-300">Contact Support</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
