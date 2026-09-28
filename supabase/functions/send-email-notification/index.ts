import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Webhook payload received:", payload);
    
    // The payload comes from the Database Webhook (e.g. INSERT on notifications table)
    const notification = payload.record;
    if (!notification || !notification.user_id) {
      return new Response("No notification data", { status: 400 });
    }

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured. Email skipped.");
      return new Response("Missing API Key", { status: 200 });
    }

    // You would normally fetch the user's email from the 'profiles' table using the Supabase Service Role Key here.
    // For this example, we assume you have the email or you fetch it here.
    const userEmail = "user@example.com"; // Replace with actual DB fetch

    // Send email using Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Connect Commons <noreply@yourdomain.com>",
        to: [userEmail],
        subject: notification.title,
        html: `<p>${notification.message}</p>`,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
