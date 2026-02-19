// app/routes/admin.users.new.tsx - Create User from Admin
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useActionData, Form, Link } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Create User - Admin - Runoot" }];
};

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const userType = formData.get("userType") as string;
  const companyName = formData.get("companyName") as string;
  const role = formData.get("role") as string || "user";
  const skipConfirmation = formData.get("skipConfirmation") === "on";

  // Validation
  if (!email || !password || !fullName || !userType) {
    return data({ error: "Email, password, full name, and user type are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return data({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (!["private", "tour_operator"].includes(userType)) {
    return data({ error: "Invalid user type" }, { status: 400 });
  }

  // Only superadmins can create admin/superadmin users
  if (role !== "user" && (admin as any).role !== "superadmin") {
    return data({ error: "Only superadmins can create admin users" }, { status: 403 });
  }

  try {
    // Create auth user via Supabase Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: skipConfirmation,
      user_metadata: {
        full_name: fullName,
        user_type: userType,
        company_name: companyName || null,
      },
    });

    if (authError) {
      return data({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return data({ error: "Failed to create user" }, { status: 500 });
    }

    // Create profile in profiles table (mark as admin-created for impersonation)
    const profileData: any = {
      id: authData.user.id,
      email,
      full_name: fullName,
      user_type: userType,
      role,
      company_name: companyName || null,
      created_by_admin: (admin as any).id,
    };
    const { error: profileError } = await (supabaseAdmin as any).from("profiles").insert(profileData);

    if (profileError) {
      // If profile creation fails, try to delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return data({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
    }

    // Log admin action
    await logAdminAction((admin as any).id, "user_created", {
      targetUserId: authData.user.id,
      details: { email, user_type: userType, role },
    });

    return redirect("/admin/users");
  } catch (err: any) {
    return data({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}

export default function AdminCreateUser() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/admin/users"
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Create User</h1>
          <p className="text-gray-500 mt-1">Add a new user to the platform</p>
        </div>
      </div>

      {/* Error message */}
      {actionData && "error" in actionData && (
        <div className="mb-6 p-4 rounded-lg bg-alert-50 border border-alert-200 text-alert-700 text-sm">
          {actionData.error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <Form method="post" className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="label">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="input w-full"
              placeholder="user@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="label">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={6}
              className="input w-full"
              placeholder="Minimum 6 characters"
            />
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="label">Full Name *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              required
              className="input w-full"
              placeholder="John Doe"
            />
          </div>

          {/* User Type */}
          <div>
            <label htmlFor="userType" className="label">User Type *</label>
            <select id="userType" name="userType" required className="input w-full">
              <option value="">Select type...</option>
              <option value="private">Private Runner</option>
              <option value="tour_operator">Tour Operator</option>
            </select>
          </div>

          {/* Company Name (conditional) */}
          <div>
            <label htmlFor="companyName" className="label">Company Name <span className="text-gray-400 font-normal">(for Tour Operators)</span></label>
            <input
              type="text"
              id="companyName"
              name="companyName"
              className="input w-full"
              placeholder="Travel Agency Name"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="label">Role</label>
            <select id="role" name="role" className="input w-full">
              <option value="user">User (default)</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Only superadmins can create admin/superadmin users</p>
          </div>

          {/* Skip email confirmation */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="skipConfirmation"
              name="skipConfirmation"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="skipConfirmation" className="text-sm text-gray-700">
              Skip email confirmation (user can login immediately)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button type="submit" className="btn-primary">
              Create User
            </button>
            <Link to="/admin/users" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
