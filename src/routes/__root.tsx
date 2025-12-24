import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Authenticated, Unauthenticated } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useScheduleNotifications } from "@/hooks/useScheduleNotifications";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Authenticated>
        <AuthenticatedLayout />
      </Authenticated>
      <Unauthenticated>
        <LoginPage />
      </Unauthenticated>
      <TanStackRouterDevtools />
    </>
  );
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const preferences = useQuery(api.preferences.get);
  const { pathname } = Route.useMatch();

  // Enable schedule notifications
  useScheduleNotifications({
    schedule: preferences?.sessionSchedule,
    enabled: preferences?.notificationsEnabled ?? false,
  });

  useEffect(() => {
    // Redirect to onboarding if preferences not set
    if (
      preferences !== undefined &&
      preferences === null &&
      pathname !== "/onboarding"
    ) {
      void navigate({ to: "/onboarding" });
    }
  }, [preferences, pathname, navigate]);

  // Show loading while checking preferences
  if (preferences === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Hide navigation on onboarding page
  const hideNavigation = pathname === "/onboarding";

  return (
    <Layout hideNavigation={hideNavigation}>
      <Outlet />
    </Layout>
  );
}

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);
    formData.set("flow", flow);

    try {
      await signIn("password", formData);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Pump Tracker</CardTitle>
        <CardDescription>
          {flow === "signIn"
            ? "Sign in to track your pumping sessions"
            : "Create an account to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              placeholder="Your password"
              required
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-md p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading
              ? "Please wait..."
              : flow === "signIn"
                ? "Sign In"
                : "Sign Up"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              type="button"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
              className="text-primary underline hover:no-underline"
            >
              {flow === "signIn" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
