import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ChangePassword from './ChangePassword';

const Login = () => {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  // Generate a random 6-digit temporary password
  const generateTempPassword = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await login(email, password);
      if (error) {
        toast.error(error);
      }
    } catch (error) {
      toast.error('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await register(email, password, fullName);
      if (error) {
        toast.error(error);
      } else {
        toast.success('Account created successfully! Please check your email to verify your account.');
      }
    } catch (error) {
      toast.error('An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call our custom edge function to generate temporary password
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: resetEmail }
      });

      if (error) {
        console.error('Password reset error:', error);
        toast.error('Failed to generate temporary password. Please try again.');
      } else {
        // Store the temporary password and show change password form
        if (data.tempPassword) {
          setTempPassword(data.tempPassword);
          toast.success('Temporary password generated! Please use it to set your new password.', {
            duration: 8000
          });
          
          // Switch to change password form
          setShowChangePassword(true);
        } else {
          toast.success('If an account with this email exists, a temporary password has been generated.', {
            duration: 8000
          });
        }
      }
    } catch (error) {
      console.error('Error during password reset:', error);
      toast.error('An error occurred while processing password reset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePasswordSuccess = () => {
    setShowChangePassword(false);
    setShowForgotPassword(false);
    setResetEmail('');
    setTempPassword('');
    toast.success('Password changed successfully! You can now login with your new password.');
  };

  const handleBackToPasswordReset = () => {
    setShowChangePassword(false);
  };

  if (showChangePassword) {
    return (
      <ChangePassword
        email={resetEmail}
        onBack={handleBackToPasswordReset}
        onSuccess={handleChangePasswordSuccess}
      />
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-energy-50 to-energy-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md energy-card">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="w-8 h-8 text-orange-500" />
              <span className="text-2xl font-bold">EnergyTracker</span>
            </div>
            <CardTitle className="text-xl">
              Reset Your Password
            </CardTitle>
            <CardDescription>
              Enter your email address and we'll generate a temporary password for you to change to a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                />
              </div>
              {tempPassword && (
                <div className="space-y-2">
                  <Label htmlFor="temp-password">Your Temporary Password</Label>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-orange-700 mb-2">Copy this temporary password:</p>
                    <p className="font-mono text-lg font-bold text-orange-800 bg-white px-3 py-2 rounded border">
                      {tempPassword}
                    </p>
                    <p className="text-xs text-orange-600 mt-2">
                      Use this to login and immediately change your password
                    </p>
                  </div>
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Generating...' : 'Generate Temporary Password'}
              </Button>
              {tempPassword && (
                <Button 
                  type="button" 
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                  onClick={() => setShowChangePassword(true)}
                >
                  Proceed to Change Password
                </Button>
              )}
              <Button 
                type="button" 
                variant="ghost"
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
                disabled={isLoading}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-energy-50 to-energy-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md energy-card">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-bold">EnergyTracker</span>
          </div>
          <CardTitle className="text-xl">
            Monitor Your Energy Consumption
          </CardTitle>
          <CardDescription>
            Track and manage your electrical usage in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">
                Login
              </TabsTrigger>
              <TabsTrigger value="signup">
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
                <Button 
                  type="button" 
                  variant="link"
                  className="w-full text-sm text-muted-foreground hover:text-orange-500"
                  onClick={() => setShowForgotPassword(true)}
                  disabled={isLoading}
                >
                  Forgot your password?
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-fullname">Full Name</Label>
                  <Input
                    id="signup-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm your password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-sm text-muted-foreground">
            Join thousands of users monitoring their energy consumption
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
