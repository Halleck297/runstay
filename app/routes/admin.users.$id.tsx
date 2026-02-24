import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, Link, useLoaderData, useSearchParams } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyProfilePublicIdFilter, getProfilePublicId } from "~/lib/publicIds";

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const name = loaderData?.targetUser?.full_name || loaderData?.targetUser?.email || "User";
  return [{ title: `${name} - Admin Users - Runoot` }];
};

function formatDateTimeStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes} UTC`;
}

function userCategory(user: any) {
  if (user.user_type === "superadmin") return "Superadmin";
  if (user.user_type === "admin") return "Admin";
  if (user.user_type === "team_leader") return "Team Leader";
  if (user.user_type === "tour_operator") return "Tour Operator";
  return "User";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const userId = params.id;
  const url = new URL(request.url);
  const tabParam = url.searchParams.get("tab");
  const tab = tabParam === "conversations" ? "conversations" : "profile";
  const selectedConversationKey = url.searchParams.get("c");

  if (!userId) {
    throw new Response("User not found", { status: 404 });
  }

  const targetUserQuery = supabaseAdmin
    .from("profiles")
    .select("*")
    ;
  const { data: targetUser } = await applyProfilePublicIdFilter(targetUserQuery as any, userId).single();

  if (!targetUser) {
    throw new Response("User not found", { status: 404 });
  }

  const { data: conversationsRaw } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, author_id),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, email),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, email),
      messages(id, sender_id, content, created_at, read_at, message_type)
    `
    )
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("updated_at", { ascending: false });

  const conversations = (conversationsRaw || []).map((conv: any) => {
    const sortedMessages = [...(conv.messages || [])].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const lastMessage = sortedMessages[sortedMessages.length - 1] || null;
    const unreadForTarget = sortedMessages.filter(
      (m: any) => m.sender_id !== userId && !m.read_at
    ).length;
    const totalMessages = sortedMessages.length;

    return {
      ...conv,
      messages: sortedMessages,
      lastMessage,
      unreadForTarget,
      totalMessages,
    };
  });

  const selectedConversation =
    conversations.find((c: any) => c.short_id === selectedConversationKey || c.id === selectedConversationKey) ||
    conversations[0] ||
    null;

  return data({
    targetUser,
    tab,
    conversations,
    selectedConversation,
  });
}

export default function AdminUserDetail() {
  const { targetUser, tab, conversations, selectedConversation } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const basePath = `/admin/users/${getProfilePublicId(targetUser as any)}`;
  const currentConversationKey = searchParams.get("c") || (selectedConversation as any)?.short_id || "";
  const profileHref = currentConversationKey
    ? `${basePath}?tab=profile&c=${encodeURIComponent(currentConversationKey)}`
    : `${basePath}?tab=profile`;
  const conversationsHref = currentConversationKey
    ? `${basePath}?tab=conversations&c=${encodeURIComponent(currentConversationKey)}`
    : `${basePath}?tab=conversations`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/users" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to users
          </Link>
          <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold text-gray-900">
            {(targetUser as any).full_name || (targetUser as any).company_name || "No name"}
          </h1>
          <p className="text-gray-500">{(targetUser as any).email}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Category</p>
            <p className="font-medium text-gray-900">{userCategory(targetUser)}</p>
          </div>
          <div>
            <p className="text-gray-500">Verified</p>
            <p className="font-medium text-gray-900">{(targetUser as any).is_verified ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="font-medium text-gray-900">{formatDateTimeStable((targetUser as any).created_at)}</p>
          </div>
          <div>
            <p className="text-gray-500">Last login</p>
            <p className="font-medium text-gray-900">
              {(targetUser as any).last_login_at ? formatDateTimeStable((targetUser as any).last_login_at) : "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={profileHref}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            tab === "profile" ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Profile
        </Link>
        <Link
          to={conversationsHref}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            tab === "conversations" ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Conversations ({conversations.length})
        </Link>
      </div>

      {tab === "profile" ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Profile details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Full name</p>
              <p className="font-medium text-gray-900">{(targetUser as any).full_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Company</p>
              <p className="font-medium text-gray-900">{(targetUser as any).company_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{(targetUser as any).email}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{(targetUser as any).phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Country</p>
              <p className="font-medium text-gray-900">{(targetUser as any).country || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">City</p>
              <p className="font-medium text-gray-900">{(targetUser as any).city || "N/A"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500">Bio</p>
              <p className="font-medium text-gray-900 whitespace-pre-wrap">{(targetUser as any).bio || "N/A"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Threads</h2>
            </div>
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-gray-100">
              {conversations.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
              ) : (
                conversations.map((conv: any) => {
                  const other =
                    conv.participant_1 === (targetUser as any).id ? conv.participant2 : conv.participant1;
                  const convKey = conv.short_id || conv.id;
                  const href = `${basePath}?tab=conversations&c=${encodeURIComponent(convKey)}`;
                  const isActive = selectedConversation && ((selectedConversation as any).id === conv.id);
                  return (
                    <Link key={conv.id} to={href} className={`block p-3 hover:bg-gray-50 ${isActive ? "bg-gray-50" : ""}`}>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {other?.company_name || other?.full_name || other?.email || "User"}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.listing?.title || "Listing"}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                        <span>{conv.totalMessages} messages</span>
                        <span>{conv.unreadForTarget} unread</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Conversation</h2>
            </div>
            {!selectedConversation ? (
              <p className="p-4 text-sm text-gray-500">Select a thread to inspect messages.</p>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto p-4 space-y-3">
                {(selectedConversation as any).messages.map((m: any) => {
                  const isFromTarget = m.sender_id === (targetUser as any).id;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        isFromTarget
                          ? "bg-gray-900 text-white ml-auto"
                          : "bg-gray-100 text-gray-800 mr-auto"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.message_type === "heart" ? "Listing saved" : m.content}</p>
                      <p className={`mt-1 text-[10px] ${isFromTarget ? "text-gray-300" : "text-gray-500"}`}>
                        {formatDateTimeStable(m.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
