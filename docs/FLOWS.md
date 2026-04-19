# Runoot — Application Flows

Last updated: 2026-04-18

This document describes all user flows currently active in the Runoot platform.
It is the source of truth for understanding how users enter, navigate, and interact with the system.

---

## 1. Primary Registration Flow (Invite via Team Leader)

This is the **only** way new runners currently join the platform.

```
1. Admin/TL creates invite → referral_invites record inserted (status: pending)
2. System sends email with link: /join/<token>
3. User clicks link → /join/$token loader validates token (checks expiry, status)
4. User fills out form:
   - Email: pre-filled and LOCKED (from invite)
   - First name, last name
   - Country, city
   - Date of birth
   - Language preference
   - Phone number + OTP verification via SMS (Twilio)
   - Password + confirm
   - Legal consent checkboxes (Terms + Privacy)
5. On submit:
   - Supabase auth user created with email_confirm: true (no separate email verify needed)
   - Profile record created with phone_verified_at set
   - Referral link created (referrals table)
   - Invite marked as accepted
   - Legal consent logged
   - Welcome email sent in user's chosen language → /profile CTA
6. User redirected to /login
7. User logs in → session cookie created → redirected to default app path
```

**Key design decisions:**
- Clicking the invite link IS the email verification. No separate verify-email step.
- Phone OTP is mandatory for all users registering via invite.
- Email is locked in the form — cannot be changed during registration.
- `email_confirm: true` is set at Supabase auth level, skipping any Supabase verification flow.

---

## 2. Password Recovery

```
1. User visits /forgot-password
2. Enters email → Supabase generates recovery token → sends password_reset email (Resend)
3. User clicks link in email → /reset-password (client-side, uses URL hash token)
4. User enters new password → Supabase updates credentials
5. Session established via /auth/session/bootstrap
6. User redirected to /login to re-authenticate
```

**Note:** After password reset the user is signed out and must log in again.

---

## 3. Admin-Created Users (Manual Account Creation)

Used for creating accounts outside the standard invite flow (e.g. mock users, test accounts, special onboarding).

### 3a. External invite (real user, created by admin)
```
1. Admin creates profile manually via admin dashboard
2. Account setup email sent with link to set password (/account-setup or similar)
3. User sets password
4. On first login: if profile.created_by_admin is set AND phone_verified_at is null
   → root.tsx redirects to /verify-phone
5. User completes phone OTP verification
6. Redirected to /login → normal flow
```

**Relevant code:** `needsAdminPhoneVerification()` in `app/lib/user-access.ts`
```ts
// Only triggers for:
// - user_type === "private" (runner)
// - created_by_admin is set
// - phone_verified_at is null
return Boolean(profile.created_by_admin) && !profile.phone_verified_at;
```

### 3b. Mock users — email access
- Created by admin
- Have a real email address
- Can log in normally
- `created_by_admin` set, but `phone_verified_at` may or may not be set

### 3c. Mock users — impersonate only
- Created by admin
- No real email / no password
- Access only via admin impersonation from the admin dashboard
- `created_by_admin` set

---

## 4. Team Leader Promotion

For existing runner users being promoted to Team Leader role.

```
1. Admin generates TL invite token → /become-tl/<token>
2. User must already be logged in
3. User accepts invite → user_type updated to "team_leader"
4. Referral code generated and saved to profile
5. Token marked as used
6. User redirected to /tl-dashboard
```

---

## 5. Public Access Request

For people who want to join but don't have an invite code.

### 5a. Via /register (runner path)
```
1. User visits /register
2. Two options:
   a. "I have an invite code" → input code → redirects to /join/<token>
   b. "Request access" → fills form → access_requests record created (source: "public_signup")
3. Admin reviews request in admin dashboard
4. If approved: admin creates invite and sends it manually
```

### 5b. Via /professional-access (Tour Operator / Team Leader / Agency)
```
1. User visits /professional-access
2. Fills form with role, company, message
3. access_requests record created (source: "contact_form")
4. Admin reviews and decides whether to approve
```

---

## 6. Login

```
1. User visits /login
2. Enters email + password
3. Supabase validates credentials
4. Profile fetched, last_login_at updated, referral status reactivated if needed
5. If needsAdminPhoneVerification(profile) → redirect to /verify-phone
6. Otherwise → redirect to getDefaultAppPath(profile):
   - team_leader → /tl-dashboard
   - tour_operator → /to-panel
   - private (runner) → /listings
```

---

## 7. Logout

```
1. User hits /logout (GET or POST)
2. Session cookie destroyed
3. Redirected to /
```

---

## 8. Session & Auth Middleware (root.tsx)

The root loader runs on every request and:
- Fetches the current user from session
- If `needsAdminPhoneVerification(user)` → 307 redirect to `/verify-phone`
  - Whitelist: `/verify-phone`, `/logout`, `/api/*`, `/auth/session/bootstrap`
- Handles Supabase token refresh
- Provides impersonation context for admins

---

## 9. Transactional Emails

| Template ID | Trigger | Recipient |
|-------------|---------|-----------|
| `welcome_user` | After registration in /join/$token | New user, in their chosen language |
| `referral_invite` | Admin/TL sends invite | Invited person |
| `account_setup` | Admin creates account manually | New user |
| `password_reset` | /forgot-password | User requesting reset |
| `join_request_notification` | Access request submitted | Admin |
| `join_request_rejected` | Admin rejects access request | Applicant |
| `platform_notification` | System events | Various |

---

## 10. Default App Paths by Role

| User type | Default path after login |
|-----------|--------------------------|
| `private` (runner) | `/listings` |
| `team_leader` | `/tl-dashboard` |
| `tour_operator` | `/to-panel` |
| `admin` / `superadmin` | `/admin` |

---

## Open Items / To Decide in Future

- **Phone OTP for Tour Operators created by admin:** Currently `needsAdminPhoneVerification` only
  checks `user_type === "private"`. Tour operators created manually by admins are NOT forced to
  verify phone. Decide whether TO accounts should also require phone verification.

- **Mock users — phone verification:** Mock accounts (impersonate-only) skip phone verification
  entirely. Document and enforce a clear policy on what mock accounts can and cannot do.

- **Listing expiration / sold status:** See CLAUDE.md — deferred product decisions section.
