import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Users, Target, Award } from "lucide-react";
import { z } from "zod";
import { JoinOrganization } from "./JoinOrganization";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
});

interface AuthPageProps {
  onAuthSuccess: (session: Session, user: User) => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showJoinOrg, setShowJoinOrg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        onAuthSuccess(session, session.user);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          onAuthSuccess(session, session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [onAuthSuccess]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = {
        email: email.trim(),
        password,
        ...(isSignUp ? { fullName: fullName.trim() } : {}),
      };

      const validation = authSchema.parse(formData);

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: validation.email,
          password: validation.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: validation.fullName,
            }
          }
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Try signing in instead.",
              variant: "destructive",
            });
            setIsSignUp(false);
          } else {
            throw error;
          }
        } else {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation link to complete your registration.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: validation.email,
          password: validation.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Invalid credentials",
              description: "Please check your email and password and try again.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Authentication Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="text-center lg:text-left text-white">
          <div className="flex items-center gap-3 justify-center lg:justify-start mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">TeamSpark</h1>
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
            Transform Your Team's
            <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              Productivity
            </span>
          </h2>
          
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Gamify your workflow with points, rewards, and real-time collaboration. 
            Make work engaging and track progress like never before.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Smart Task Management</h3>
              <p className="text-sm text-white/80">Organize work with phases, priorities, and real-time tracking</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Rewards System</h3>
              <p className="text-sm text-white/80">Earn points for completed tasks and redeem exciting rewards</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Team Collaboration</h3>
              <p className="text-sm text-white/80">See who's working on what with live presence indicators</p>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="space-y-4">
          {showJoinOrg ? (
            <JoinOrganization onJoinSuccess={() => window.location.reload()} />
          ) : (
            <Card variant="elevated" className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-sm border-white/20">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">
                  {isSignUp ? "Join TeamSpark" : "Welcome Back"}
                </CardTitle>
                <CardDescription>
                  {isSignUp 
                    ? "Create your account to start boosting productivity" 
                    : "Sign in to your account to continue"
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSignUp ? "Create Account" : "Sign In"}
                  </Button>
                </form>
                
                <div className="mt-6 text-center space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-primary hover:underline block"
                  >
                    {isSignUp 
                      ? "Already have an account? Sign in" 
                      : "Don't have an account? Sign up"
                    }
                  </button>
                  
                  {/* <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-muted" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">Or</span>
                    </div>
                  </div> */}
                  
                  {/* <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJoinOrg(true)}
                    className="w-full"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Join with Invitation Code
                  </Button> */}
                </div>
              </CardContent>
            </Card>
          )}
          
          {showJoinOrg && (
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowJoinOrg(false)}
                className="text-white hover:text-white/80"
              >
                ← Back to Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}