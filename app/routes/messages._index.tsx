import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useSearchParams } from "react-router";
import Conversation, { action as conversationAction, loader as conversationLoader } from "./messages.$id";


export const meta: MetaFunction = () => {
  return [{ title: "Messages - Runoot" }];
};

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const conversationPublicId = url.searchParams.get("c");

  if (!conversationPublicId) {
    return data({ noConversationSelected: true });
  }

  return conversationLoader({
    ...args,
    params: { ...(args.params || {}), id: conversationPublicId },
  } as LoaderFunctionArgs);
}

export async function action(args: ActionFunctionArgs) {
  const url = new URL(args.request.url);
  const conversationPublicId = url.searchParams.get("c");

  if (!conversationPublicId) {
    return data({ error: "No conversation selected" }, { status: 400 });
  }

  return conversationAction({
    ...args,
    params: { ...(args.params || {}), id: conversationPublicId },
  } as ActionFunctionArgs);
}

export default function MessagesIndex() {
  const [searchParams] = useSearchParams();
  const conversationPublicId = searchParams.get("c");

  if (conversationPublicId) {
    return <Conversation />;
  }

  // This component is shown only on desktop when no conversation is selected
  // On mobile, the sidebar (conversation list) is shown instead
  return (
    <div className="hidden md:flex flex-1 items-center justify-center bg-white/95 backdrop-blur-sm rounded-r-lg">
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
