import { Link } from 'react-router-dom';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8 text-stone-800">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow sm:p-10">
        <h1 className="mb-6 text-2xl font-bold text-stone-900">Terms & Conditions</h1>
        <p className="mb-4 text-sm text-stone-500">
          Effective Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">1. Acceptance of Terms</h2>
          <p className="text-sm leading-relaxed">
            By accessing and using our digital menu and ordering system, you agree to comply with and be bound by these Terms & Conditions. This service is provided by <strong>Cafe Chapter 1 Restaurant Pvt. Ltd.</strong>
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">2. Restaurant Ordering Rules</h2>
          <p className="text-sm leading-relaxed">
            Orders placed through the digital menu are final once confirmed. For dine-in customers, please ensure you have selected the correct table number. Takeaway orders must be picked up promptly at the designated time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">3. User Responsibilities</h2>
          <p className="text-sm leading-relaxed">
            You agree to provide accurate information (such as your name and optionally your phone number) when placing an order. You must not use our service for any unlawful or unauthorized purpose.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">4. Pricing & Availability Disclaimer</h2>
          <p className="text-sm leading-relaxed">
            All prices and item availability are subject to change without prior notice. While we strive to keep our digital menu accurate, occasional discrepancies may occur. The restaurant reserves the right to cancel or modify orders if an item becomes unavailable.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">5. Intellectual Property</h2>
          <p className="text-sm leading-relaxed">
            All content, including text, graphics, logos, and images on this platform, is the property of Cafe Chapter 1 Restaurant Pvt. Ltd. and is protected by intellectual property laws. Unauthorized reproduction or use is strictly prohibited.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">6. Contact Information</h2>
          <p className="text-sm leading-relaxed">
            If you have any questions or concerns regarding these Terms, please contact us at:
          </p>
          <ul className="ml-4 mt-2 list-disc text-sm leading-relaxed text-stone-700">
            <li>Phone: +91 7800327061</li>
            <li>Address: Green Park, Gautam Nagar, New Delhi</li>
          </ul>
        </section>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-block rounded-lg bg-emerald-700 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Back to Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
