// Deprecated compatibility layer.
// New email system lives under app/lib/email/*
import { renderEmailTemplate } from "~/lib/email/registry";

interface ReferralInviteTemplateArgs {
  inviterName: string;
  referralLink: string;
  welcomeMessage?: string | null;
}

export function buildReferralInviteEmailTemplate(args: ReferralInviteTemplateArgs) {
  return renderEmailTemplate({
    templateId: "referral_invite",
    payload: args,
    locale: "en",
  });
}
