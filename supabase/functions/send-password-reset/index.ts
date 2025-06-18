
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
}

// Generate a random 6-digit code
function generateTempPassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Minimal Resend function for sending emails
async function sendWithResend(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_SENDER_EMAIL");

  console.log("RESEND_API_KEY:", apiKey ? "Present" : "Missing");
  console.log("RESEND_SENDER_EMAIL:", fromEmail);

  if (!apiKey || !fromEmail) {
    throw new Error("Missing RESEND_API_KEY or RESEND_SENDER_EMAIL environment variables");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Resend API error status:", res.status);
    console.error("Resend API error body:", errorBody);
    throw new Error(`Failed to send email via Resend: ${res.status} - ${errorBody}`);
  }

  const json = await res.json();
  console.log("Resend success:", json);
  return json;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Processing password reset request for email: ${email}`);

    // Check if user exists
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to process request' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      // For security, we still return success even if user doesn't exist
      console.log(`User not found for email: ${email}, but returning success for security`);
      return new Response(
        JSON.stringify({ 
          message: 'If an account with this email exists, a temporary password has been sent.',
          email: email 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    console.log(`Generated temporary password for ${email}: ${tempPassword}`);
    
    // Update user password with the temporary password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Error updating user password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate temporary password' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Password updated successfully for user ${user.id}`);

    // Prepare email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Energy Tracker</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚡ Energy Tracker</h1>
              <p style="color: #fff; margin: 10px 0 0 0; opacity: 0.9;">Password Reset Request</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
              <h2 style="color: #333; margin-top: 0;">Your Temporary Password</h2>
              <p>Hello,</p>
              <p>You requested a password reset for your Energy Tracker account. Please use the temporary password below to log in and set a new password:</p>
              
              <div style="background: #fff; border: 2px solid #f97316; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                  <h3 style="margin: 0 0 10px 0; color: #f97316;">Temporary Password</h3>
                  <div style="font-size: 24px; font-weight: bold; color: #333; font-family: 'Courier New', monospace; letter-spacing: 2px;">
                      ${tempPassword}
                  </div>
              </div>
              
              <div style="background: #e8f4fd; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #0ea5e9;">Next Steps:</h4>
                  <ol style="margin: 0; padding-left: 20px;">
                      <li>Go to the Energy Tracker login page</li>
                      <li>Enter your email address: <strong>${email}</strong></li>
                      <li>Use the temporary password above</li>
                      <li>You'll be prompted to set a new permanent password</li>
                  </ol>
              </div>
              
              <p style="margin-top: 30px;"><strong>Important:</strong> This temporary password will expire after you set a new password. For security reasons, please change it as soon as possible.</p>
              
              <p>If you didn't request this password reset, please ignore this email or contact our support team.</p>
              
              <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 30px 0;">
              
              <p style="margin: 0; color: #6c757d; font-size: 14px; text-align: center;">
                  This email was sent by Energy Tracker<br>
                  © ${new Date().getFullYear()} Energy Tracker. All rights reserved.
              </p>
          </div>
      </body>
      </html>
    `;

    const textContent = `Password Reset - Energy Tracker

Your temporary password is: ${tempPassword}

Please use this to log in and set a new password.

Next Steps:
1. Go to the Energy Tracker login page
2. Enter your email address: ${email}
3. Use the temporary password above
4. You'll be prompted to set a new permanent password

If you didn't request this, please ignore this email.`;

    console.log('Attempting to send email using Resend API...');

    try {
      // Send email using Resend
      const result = await sendWithResend(
        email,
        'Password Reset - Energy Tracker',
        emailHtml,
        textContent
      );

      console.log(`Password reset email sent successfully to ${email}. Message ID: ${result.id}`);

      return new Response(
        JSON.stringify({ 
          message: 'Password reset email sent successfully. Please check your email for the temporary password.',
          email: email,
          messageId: result.id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (emailError: any) {
      console.error('Failed to send email via Resend:', emailError.message);
      
      // For development/testing, include the temporary password in the response
      return new Response(
        JSON.stringify({ 
          message: 'Temporary password generated but email sending failed. For testing, the temporary password is included.',
          email: email,
          tempPassword: tempPassword,
          error: `Email sending failed: ${emailError.message}`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error: any) {
    console.error('Error in send-password-reset function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + error.message }),
      {
        status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
