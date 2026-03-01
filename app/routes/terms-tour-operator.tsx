import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Tour Operator Terms Addendum | Runoot" },
    {
      name: "description",
      content:
        "Additional terms applicable to Tour Operators using the Runoot platform.",
    },
  ];
};

export default function TourOperatorTermsAddendum() {
  const lastUpdated = "February 24, 2026";

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <a href="/to-panel/settings" className="text-sm text-brand-600 hover:text-brand-700">
            ← Back to settings
          </a>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Tour Operator Terms Addendum</h1>
          <p className="mt-2 text-gray-500">Last updated: {lastUpdated}</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-8 rounded-lg bg-white p-8 shadow-sm">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Scope</h2>
            <p className="text-gray-700 leading-relaxed">
              This Addendum applies to users registered as <strong>Tour Operators</strong> and supplements the general Terms of Service.
              In case of conflict, this Addendum prevails for Tour Operator accounts.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Professional Status and Authorization</h2>
            <p className="text-gray-700 leading-relaxed">
              You represent and warrant that you operate lawfully as a professional travel operator in your jurisdiction and that you hold
              all licenses, authorizations, registrations, and insurance required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">3. Accuracy of Listings and Commercial Information</h2>
            <p className="text-gray-700 leading-relaxed">
              You are solely responsible for the accuracy, legality, and completeness of your listings, package terms, prices, availability,
              restrictions, and transfer conditions. Any misleading or incomplete commercial communication is your exclusive responsibility.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Taxes, Invoicing, and Regulatory Compliance</h2>
            <p className="text-gray-700 leading-relaxed">
              You are solely responsible for tax compliance, invoicing, VAT obligations, accounting duties, and consumer-law obligations
              applicable to your activity. Runoot does not calculate, collect, or remit taxes on your behalf.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">5. Customer Relationship and After-Sales Duties</h2>
            <p className="text-gray-700 leading-relaxed">
              All pre-contractual information, contractual terms, post-sale support, cancellation handling, refund management, and dispute
              handling with your customers remain your sole responsibility.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">6. Identity Verification and Documentation Requests</h2>
            <p className="text-gray-700 leading-relaxed">
              Runoot may request documentation to verify your business identity and compliance status. Failure to provide requested
              documentation in a timely manner may result in listing removal, account limitations, suspension, or termination.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">7. Fraud, Abuse, and Chargeback Risk</h2>
            <p className="text-gray-700 leading-relaxed">
              Runoot may take immediate protective action in case of suspected fraud, abuse, unauthorized resale practices, chargeback abuse,
              or material policy violations. This includes temporary or permanent account restrictions without prior notice when necessary.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">8. Indemnity</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to indemnify and hold harmless Runoot, its officers, and affiliates from claims, liabilities, penalties, losses, and
              costs (including legal fees) arising out of your professional operations, listings, customer disputes, tax/regulatory breaches,
              or violations of applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">9. Public Business Profile Requirement</h2>
            <p className="text-gray-700 leading-relaxed">
              Tour Operator accounts are managed as professional public profiles on the platform. Visibility settings available to private
              users may not apply to Tour Operator accounts.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-900">10. Contacts</h2>
            <p className="text-gray-700 leading-relaxed">
              For legal and compliance matters related to this Addendum, contact:{" "}
              <a href="mailto:legal@runoot.com" className="text-brand-600 hover:underline">
                legal@runoot.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <a href="/terms" className="hover:text-brand-600">
            Terms
          </a>
          <span className="mx-2">•</span>
          <a href="/privacy-policy" className="hover:text-brand-600">
            Privacy
          </a>
          <span className="mx-2">•</span>
          <a href="/cookie-policy" className="hover:text-brand-600">
            Cookie Policy
          </a>
        </div>
      </main>
    </div>
  );
}
