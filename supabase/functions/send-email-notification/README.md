# Email Notification Setup

To enable email notifications when assignments are assigned, submissions are received, or revisions are required, follow these manual steps:

1. **Get an Email Provider API Key**:
   Sign up for Resend (https://resend.com) or SendGrid and get an API Key.

2. **Add Secret to Supabase**:
   Run the following command in your terminal using the Supabase CLI:
   `supabase secrets set RESEND_API_KEY=your_api_key`

3. **Deploy the Edge Function**:
   `supabase functions deploy send-email-notification`

4. **Create a Database Webhook**:
   Go to your Supabase Dashboard -> Database -> Webhooks.
   Create a new webhook:
   - **Name**: Email Notifications Trigger
   - **Table**: `notifications`
   - **Events**: `INSERT`
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: (Your Edge Function URL, found in Edge Functions tab)
   - **Headers**: Add `Authorization: Bearer [anon_or_service_key]`

Now, every time the PostgreSQL trigger inserts a new notification into the `notifications` table, Supabase will call this Edge Function to send a corresponding email.
