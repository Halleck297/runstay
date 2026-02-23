import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Link, useSearchParams } from "react-router";
import Conversation, { action as conversationAction, loader as conversationLoader } from "./messages.$id";
import { useI18n } from "~/hooks/useI18n";


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
    return data({ errorKey: "no_conversation_selected" as const }, { status: 400 });
  }

  return conversationAction({
    ...args,
    params: { ...(args.params || {}), id: conversationPublicId },
  } as ActionFunctionArgs);
}

export default function MessagesIndex() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const conversationPublicId = searchParams.get("c");

  if (conversationPublicId) {
    return <Conversation />;
  }

  // This component is shown only on desktop when no conversation is selected
  // On mobile, the sidebar (conversation list) is shown instead
  return (
    <div className="hidden md:flex flex-1 items-center justify-center bg-white/95 backdrop-blur-[2px] md:rounded-r-3xl">
      <div className="mx-auto w-full max-w-md px-6">
        <div className="rounded-2xl border border-gray-200 bg-white/90 p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <svg
              className="h-7 w-7"
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
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {t("messages.select_conversation")}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {t("messages.select_conversation_help")}
          </p>
          <div className="mt-6">
            <Link
              to="/listings"
              className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md"
            >
              {t("messages.browse_listings")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
