import type { MetaFunction } from "react-router";


export const meta: MetaFunction = () => {
  return [{ title: "Messages - Runoot" }];
};

export default function MessagesIndex() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-r-lg">
      <div className="text-center p-8">
        <svg
          className="mx-auto h-16 w-16 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h2 className="mt-4 text-lg font-medium text-gray-900">
          Select a conversation
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Choose a conversation from the list to start messaging
        </p>
      </div>
    </div>
  );
}
