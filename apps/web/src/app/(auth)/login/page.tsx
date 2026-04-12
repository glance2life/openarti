import { LoginForm } from "@/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_URL = process.env.OPENARTI_API_URL || "http://localhost:3001";

async function getAuthConfig() {
  try {
    const res = await fetch(`${API_URL}/api/auth/config`, {
      cache: "no-store",
    });
    return res.json() as Promise<{
      allowRegistration: boolean;
      googleOAuth: boolean;
    }>;
  } catch {
    return { allowRegistration: false, googleOAuth: false };
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const config = await getAuthConfig();
  const { redirect: redirectTo } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm googleOAuth={config.googleOAuth} redirectTo={redirectTo} />
        </CardContent>
        {config.allowRegistration && (
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <a href="/register" className="text-foreground underline">
                Register
              </a>
            </p>
          </CardFooter>
        )}
    </Card>
  );
}
