import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8 text-stone-800">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow sm:p-10">
        <h1 className="mb-6 text-2xl font-bold text-stone-900">Privacy Policy</h1>
        <p className="mb-4 text-sm text-stone-500">
          Effective Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">1. Who We Are</h2>
          <p className="text-sm leading-relaxed">
            This website is operated by <strong>Cafe Chapter 1 Restaurant Pvt. Ltd.</strong>, located at
            Green Park, Gautam Nagar, New Delhi. We are a legitimate in-restaurant dining business.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">2. What Data We Collect</h2>
          <p className="text-sm leading-relaxed">
            When you place an order through our digital menu, we may collect:
          </p>
          <ul className="ml-4 mt-2 list-disc text-sm leading-relaxed text-stone-700">
            <li>Your name (to identify the order)</li>
            <li>Your mobile phone number (optional, only for order-related communication)</li>
            <li>Your table number (for dine-in orders)</li>
            <li>Order items and preferences</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">3. Why We Collect Phone Numbers</h2>
          <p className="text-sm leading-relaxed">
            We collect phone numbers <strong>only</strong> for order-related communication, such as notifying you when your
            order is ready or if there is an issue with your order. We do not use your phone number for marketing,
            advertising, or share it with any third parties.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">4. How We Protect Your Data</h2>
          <p className="text-sm leading-relaxed">
            We use secure HTTPS connections. We do not collect sensitive financial information such as credit card
            numbers or banking details on this website. All payments, if any, are handled directly at the restaurant counter.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">5. Data Retention</h2>
          <p className="text-sm leading-relaxed">
            Order data is retained only as long as necessary for restaurant operations and record keeping. We do not
            sell or share your personal information with external advertisers or data brokers.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">6. Your Consent</h2>
          <p className="text-sm leading-relaxed">
            By checking the consent box before placing an order, you agree that we may use the information you provide
            solely for processing your order and communicating with you about that order.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">7. Contact Us</h2>
          <p className="text-sm leading-relaxed">
            If you have any questions about this Privacy Policy or how we handle your data, please contact us:
          </p>
          <ul className="ml-4 mt-2 list-disc text-sm leading-relaxed text-stone-700">
            <li>Phone: +91 7800327061</li>
            <li>Address: Green Park, Gautam Nagar, New Delhi</li>
            <li>Instagram: @cafe_chapter_1</li>
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
