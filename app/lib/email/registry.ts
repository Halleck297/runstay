import { renderPasswordResetTemplate, type PasswordResetPayload } from "./templates/passwordReset";
import { renderAccountSetupTemplate, type AccountSetupPayload } from "./templates/accountSetup";
import { renderPlatformNotificationTemplate, type PlatformNotificationPayload } from "./templates/platformNotification";
import { renderReferralInviteTemplate, type ReferralInvitePayload } from "./templates/referralInvite";
import { renderAmbassadorInviteTemplate, type AmbassadorInvitePayload } from "./templates/ambassadorInvite";
import { renderJoinRequestNotificationTemplate, type JoinRequestNotificationPayload } from "./templates/joinRequestNotification";
import { renderJoinRequestRejectedTemplate, type JoinRequestRejectedPayload } from "./templates/joinRequestRejected";
import { renderWelcomeUserTemplate, type WelcomeUserPayload } from "./templates/welcomeUser";
import type { EmailLocale, EmailTemplateId, RenderedEmailTemplate } from "./types";

export interface EmailTemplatePayloadMap {
  referral_invite: ReferralInvitePayload;
  ambassador_invite: AmbassadorInvitePayload;
  password_reset: PasswordResetPayload;
  account_setup: AccountSetupPayload;
  platform_notification: PlatformNotificationPayload;
  join_request_notification: JoinRequestNotificationPayload;
  join_request_rejected: JoinRequestRejectedPayload;
  welcome_user: WelcomeUserPayload;
}

export function renderEmailTemplate<T extends EmailTemplateId>(args: {
  templateId: T;
  payload: EmailTemplatePayloadMap[T];
  locale: EmailLocale;
}): RenderedEmailTemplate {
  switch (args.templateId) {
    case "referral_invite":
      return renderReferralInviteTemplate(args.payload as ReferralInvitePayload, args.locale);
    case "ambassador_invite":
      return renderAmbassadorInviteTemplate(args.payload as AmbassadorInvitePayload, args.locale);
    case "password_reset":
      return renderPasswordResetTemplate(args.payload as PasswordResetPayload, args.locale);
    case "account_setup":
      return renderAccountSetupTemplate(args.payload as AccountSetupPayload, args.locale);
    case "platform_notification":
      return renderPlatformNotificationTemplate(args.payload as PlatformNotificationPayload, args.locale);
    case "join_request_notification":
      return renderJoinRequestNotificationTemplate(args.payload as JoinRequestNotificationPayload, args.locale);
    case "join_request_rejected":
      return renderJoinRequestRejectedTemplate(args.payload as JoinRequestRejectedPayload, args.locale);
    case "welcome_user":
      return renderWelcomeUserTemplate(args.payload as WelcomeUserPayload, args.locale);
    default:
      throw new Error(`Unknown template: ${String(args.templateId)}`);
  }
}
