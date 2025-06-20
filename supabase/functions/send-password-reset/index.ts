
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
      return new Response(
        JSON.stringify({ 
          message: 'If an account with this email exists, a temporary password has been sent to your email.',
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

    // Send email with temporary password
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f97316; margin: 0;">⚡ EnergyTracker</h1>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">Temporary Password Generated</h2>
          
          <p style="color: #666; line-height: 1.6;">
            We've generated a temporary password for your account. Please use this password to login and immediately change it to a new secure password.
          </p>
          
          <div style="background-color: #f8f9fa; border: 2px solid #f97316; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; color: #333; font-weight: bold;">Your Temporary Password:</p>
            <p style="font-size: 24px; font-weight: bold; color: #f97316; letter-spacing: 2px; margin: 0;">${tempPassword}</p>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">🔒 Important Security Instructions:</h3>
            <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
              <li>Use this temporary password to login immediately</li>
              <li>Change your password as soon as you login</li>
              <li>This temporary password will expire after you change it</li>
              <li>Do not share this password with anyone</li>
              <li>If you didn't request this, please contact support</li>
            </ul>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-top: 30px;">
            Best regards,<br>
            The EnergyTracker Team
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;

      const emailText = `
EnergyTracker - Temporary Password

Your temporary password is: ${tempPassword}

Important Security Instructions:
- Use this temporary password to login immediately
- Change your password as soon as you login
- This temporary password will expire after you change it
- Do not share this password with anyone
- If you didn't request this, please contact support

Best regards,
The EnergyTracker Team
      `;

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: 'Your Temporary Password - EnergyTracker',
          htmlContent: emailHtml,
          textContent: emailText
        }
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        // Still return success to user for security, but log the error
      }
    } catch (emailError) {
      console.error('Error in email sending process:', emailError);
      // Continue without failing the password reset
    }

    // Return success message without revealing the temporary password
    return new Response(
      JSON.stringify({ 
        message: 'A temporary password has been sent to your email. Please check your inbox and use it to login.',
        email: email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

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
