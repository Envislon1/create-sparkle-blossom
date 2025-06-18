
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationRequest {
  email: string;
  userId: string;
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
    const { email, userId }: VerificationRequest = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: 'Email and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Sending verification email to: ${email}`);

    // Generate verification token (in a real app, you'd store this in database)
    const verificationToken = crypto.randomUUID();
    const verificationUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${verificationToken}&type=email&redirect_to=${Deno.env.get('SUPABASE_URL')}/`;

    // Send verification email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Energy Tracker</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚡ Energy Tracker</h1>
              <p style="color: #fff; margin: 10px 0 0 0; opacity: 0.9;">Welcome to Energy Tracker!</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
              <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
              <p>Hello,</p>
              <p>Thank you for signing up for Energy Tracker! To complete your registration and start monitoring your energy consumption, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                      Verify My Email Address
                  </a>
              </div>
              
              <div style="background: #e8f4fd; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #0ea5e9;">After verification, you'll be able to:</h4>
                  <ul style="margin: 0; padding-left: 20px;">
                      <li>Monitor your real-time energy consumption</li>
                      <li>Track energy usage across multiple devices</li>
                      <li>Set up energy budgets and alerts</li>
                      <li>Generate detailed energy reports</li>
                  </ul>
              </div>
              
              <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
              <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px;">
                  ${verificationUrl}
              </p>
              
              <p style="margin-top: 30px;"><strong>Note:</strong> This verification link will expire in 24 hours for security reasons.</p>
              
              <p>If you didn't create an account with Energy Tracker, please ignore this email.</p>
              
              <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 30px 0;">
              
              <p style="margin: 0; color: #6c757d; font-size: 14px; text-align: center;">
                  This email was sent by Energy Tracker<br>
                  © ${new Date().getFullYear()} Energy Tracker. All rights reserved.
              </p>
          </div>
      </body>
      </html>
    `;

    // Call the send-email function
    const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        to: email,
        subject: 'Verify Your Email - Energy Tracker',
        htmlContent: emailHtml,
        textContent: `Welcome to Energy Tracker!\n\nPlease verify your email address by clicking the following link:\n${verificationUrl}\n\nIf you didn't create an account, please ignore this email.`
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text();
      console.error('Email sending failed:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send verification email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Verification email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        message: 'Verification email sent successfully. Please check your email to verify your account.',
        email: email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-verification-email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
