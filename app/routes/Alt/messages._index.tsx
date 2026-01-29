import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Messages - Runoot" }];
};

export default function MessagesIndex() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200 rounded-2xl">
      <div className="text-center p-8 max-w-sm">
        {/* Animated Icon */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          {/* Background circles */}
          <div className="absolute inset-0 bg-emerald-100 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-emerald-50 rounded-full" />
          
          {/* Icon container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>

          {/* Decorative dots */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
        </div>

        <h2 className="text-xl font-bold text-stone-900 mb-2">
          Select a conversation
        </h2>
        <p className="text-stone-500 leading-relaxed">
          Choose a conversation from the list to start messaging with sellers and buyers
        </p>

        {/* Helpful tips */}
        <div className="mt-8 pt-6 border-t border-stone-200">
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-3">Quick tips</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Be clear about your requirements</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Always verify details before paying</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Keep all communication on platform</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
