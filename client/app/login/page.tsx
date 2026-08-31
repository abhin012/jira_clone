"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";
import { AlertCircle, ArrowRight, FolderKanban } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

type Step = "EMAIL" | "SIGNUP" | "CREATE_PASSWORD" | "LOGIN";

const page = () => {
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("EMAIL");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const resetToEmailStep = () => {
    setStep("EMAIL");
    setName("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setInfo("");
  };

  const proceedFromEmail = async (intent: "continue" | "signup") => {
    if (!email.trim()) {
      setError("Please enter your email first");
      return;
    }

    setError("");
    setInfo("");
    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/api/users/check-email", { email });
      const status = res.data.status;

      if (status === "NEW") {
        setStep("SIGNUP");
      } else if (status === "NEEDS_PASSWORD") {
        setStep("CREATE_PASSWORD");
      } else {
        if (intent === "signup") {
          setInfo("An account already exists for this email — please log in below.");
        }
        setStep("LOGIN");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    proceedFromEmail("continue");
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/api/users/signup", {
        name,
        email,
        password,
        role: "USER",
        avatar: `https://i.pravatar.cc/150?u=${email}`,
      });
      login(res.data.user, res.data.token);
      router.push("/setup-project");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/api/users/set-password", {
        email,
        password,
      });
      login(res.data.user, res.data.token);
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to set password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/api/users/login", {
        email,
        password,
      });
      login(res.data.user, res.data.token);
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const stepConfig: Record<Step, { title: string; description: string }> = {
    EMAIL: {
      title: "Log in or sign up",
      description: "Enter your email to get started",
    },
    SIGNUP: {
      title: "Create your account",
      description: `Setting up an account for ${email}`,
    },
    CREATE_PASSWORD: {
      title: "Create your password",
      description: `You were added to a project as ${email} — set a password to finish setting up your account`,
    },
    LOGIN: {
      title: "Welcome back",
      description: `Enter your password for ${email}`,
    },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F5F7] p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-[#0052CC] text-white">
            <FolderKanban className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#172B4D]">
            {stepConfig[step].title}
          </h1>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">{stepConfig[step].title}</CardTitle>
            <CardDescription>{stepConfig[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {info && (
              <div className="mb-4 flex gap-3 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{info}</span>
              </div>
            )}

            {step === "EMAIL" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Email address
                  </label>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    required
                    autoFocus
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#0052CC] text-white hover:bg-[#0747A6]"
                >
                  {isLoading ? "Checking..." : "Continue"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  className="w-full"
                  onClick={() => proceedFromEmail("signup")}
                >
                  Sign up
                </Button>
              </form>
            )}

            {step === "SIGNUP" && (
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Full name
                  </label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    required
                    autoFocus
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    required
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Confirm password
                  </label>
                  <Input
                    type="password"
                    placeholder="Re-enter your password"
                    required
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#0052CC] text-white hover:bg-[#0747A6]"
                >
                  {isLoading ? "Creating account..." : "Create account"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            )}

            {step === "CREATE_PASSWORD" && (
              <form onSubmit={handleCreatePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    required
                    autoFocus
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Confirm password
                  </label>
                  <Input
                    type="password"
                    placeholder="Re-enter your password"
                    required
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#0052CC] text-white hover:bg-[#0747A6]"
                >
                  {isLoading ? "Setting password..." : "Create password"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            )}

            {step === "LOGIN" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#6B778C]">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Your password"
                    required
                    autoFocus
                    className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#0052CC] text-white hover:bg-[#0747A6]"
                >
                  {isLoading ? "Logging in..." : "Log in"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            )}

            {step !== "EMAIL" && (
              <div className="mt-6 text-center text-sm text-[#6B778C]">
                <button
                  onClick={resetToEmailStep}
                  className="text-[#0052CC] hover:underline font-semibold"
                >
                  Use a different email
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-6 text-xs text-[#6B778C]">
          <span>Privacy Policy</span>
          <span>User Agreement</span>
        </div>
      </div>
    </div>
  );
};

export default page;