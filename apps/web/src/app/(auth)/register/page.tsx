import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
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

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const config = await getAuthConfig();
  const params = await searchParams;

  if (!config.allowRegistration && !params.token) {
    redirect("/login");
  }

  return (
    <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Enter your details to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm inviteToken={params.token} />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-foreground underline">
              Sign in
            </a>
          </p>
        </CardFooter>
    </Card>
  );
}
