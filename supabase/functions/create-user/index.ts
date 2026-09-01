// Connect Commons — Edge Function: create-user
// Allows an authenticated admin to create a new Supabase Auth user + profile.
// The service-role key is used ONLY inside this function and is NEVER sent to the browser.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Validate env variables ────────────────────────────
    const supabaseUrl     = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey         = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return errorResponse(500, "Server configuration error.");
    }

    // ── 2. Authenticate the REQUESTING user using their JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "Authorization header missing.");
    }

    // Client with the requesting user's JWT — used to verify identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: requester }, error: authError } = await userClient.auth.getUser();
    if (authError || !requester) {
      return errorResponse(401, "Invalid or expired session.");
    }

    // ── 3. Verify requester is an active admin ───────────────
    // Use service-role client to bypass RLS for this internal check
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: requesterProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", requester.id)
      .single();

    if (profileError || !requesterProfile) {
      return errorResponse(403, "Could not verify your permissions.");
    }
    if (requesterProfile.role !== "admin" || !requesterProfile.is_active) {
      return errorResponse(403, "Only active admins can create users.");
    }

    // ── 4. Parse and validate the request body ───────────────
    const body = await req.json();
    const { full_name, email, password, role } = body;

    if (!full_name?.trim()) return errorResponse(400, "Full name is required.");
    if (!email?.trim())     return errorResponse(400, "Email is required.");
    if (!password)          return errorResponse(400, "Password is required.");
    if (password.length < 8) return errorResponse(400, "Password must be at least 8 characters.");
    if (!["admin", "user"].includes(role)) {
      return errorResponse(400, "Role must be 'admin' or 'user'.");
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return errorResponse(400, "Invalid email address.");
    }

    // ── 5. Check for duplicate email ─────────────────────────
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return errorResponse(409, "A user with this email already exists.");
    }

    // ── 6. Create the Supabase Auth user ─────────────────────
    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,          // skip email confirmation — admin is creating
      user_metadata: {
        full_name: full_name.trim(),
        role,                       // stored in metadata; trigger also reads this
      },
    });

    if (createError) {
      console.error("Auth user creation error:", createError.message);
      if (createError.message.includes("already been registered")) {
        return errorResponse(409, "A user with this email already exists.");
      }
      return errorResponse(500, "Failed to create user account.");
    }

    const newUserId = newUserData.user.id;

    // ── 7. Upsert profile (trigger may have already created it)
    const { error: profileUpsertError } = await adminClient
      .from("profiles")
      .upsert({
        id:        newUserId,
        full_name: full_name.trim(),
        email:     email.trim().toLowerCase(),
        role,
        is_active: true,
      }, { onConflict: "id" });

    if (profileUpsertError) {
      console.error("Profile upsert error:", profileUpsertError.message);
      // Auth user was created — try to clean up to avoid orphans
      await adminClient.auth.admin.deleteUser(newUserId);
      return errorResponse(500, "Failed to create user profile. Please try again.");
    }

    // ── 8. Return safe success response ──────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id:         newUserId,
          full_name:  full_name.trim(),
          email:      email.trim().toLowerCase(),
          role,
          is_active:  true,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return errorResponse(500, "An unexpected error occurred.");
  }
});

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
