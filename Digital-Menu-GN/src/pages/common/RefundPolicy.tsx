import { Link } from 'react-router-dom';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8 text-stone-800">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow sm:p-10">
        <h1 className="mb-6 text-2xl font-bold text-stone-900">Refund & Cancellation Policy</h1>
        <p className="mb-4 text-sm text-stone-500">
          Effective Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">1. Overview</h2>
          <p className="text-sm leading-relaxed">
            <strong>Cafe Chapter 1 Restaurant Pvt. Ltd.</strong> prepares all food and beverage items fresh upon order confirmation. Due to the perishable nature of our products, our cancellation and refund policies are strict.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">2. Order Cancellations</h2>
          <ul className="ml-4 mt-2 list-disc text-sm leading-relaxed text-stone-700">
            <li>Orders once placed and confirmed cannot be cancelled after the kitchen has started preparation.</li>
            <li>If you need to make changes to your order, please contact the staff immediately. We will try our best to accommodate requests before preparation begins, but changes are not guaranteed.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">3. Refunds</h2>
          <ul className="ml-4 mt-2 list-disc text-sm leading-relaxed text-stone-700">
            <li>Refunds are generally not applicable for completed dine-in or takeaway orders.</li>
            <li>In the rare event of a duplicate payment or failed order processing due to technical issues, customers may contact us for support and applicable refunds.</li>
            <li>If you have received an incorrect or unsatisfactory item, please notify the staff immediately at the time of service for a replacement or adjustment, at the restaurant's discretion.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-stone-900">4. Contact Us for Assistance</h2>
          <p className="text-sm leading-relaxed">
            If you need help regarding an order, payment issue, or refund request, please contact us:
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
