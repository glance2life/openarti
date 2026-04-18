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

interface InvitePreview {
  email: string;
  expired: boolean;
  accepted: boolean;
}

async function getInvitePreview(token: string): Promise<
  | { ok: true; invite: InvitePreview }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${API_URL}/invitations/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return {
        ok: false,
        error: body?.error?.message || "Invitation not found",
      };
    }
    const invite = (await res.json()) as InvitePreview;
    return { ok: true, invite };
  } catch {
    return { ok: false, error: "Could not load invitation" };
  }
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (token) {
    const result = await getInvitePreview(token);
    if (!result.ok) {
      return (
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invalid invitation</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <a href="/login" className="text-sm text-foreground underline">
              Back to sign in
            </a>
          </CardFooter>
        </Card>
      );
    }
    const { invite } = result;
    if (invite.expired || invite.accepted) {
      return (
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invitation unavailable</CardTitle>
            <CardDescription>
              {invite.accepted
                ? "This invitation has already been used."
                : "This invitation has expired."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <a href="/login" className="text-sm text-foreground underline">
              Back to sign in
            </a>
          </CardFooter>
        </Card>
      );
    }

    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Accept invitation</CardTitle>
          <CardDescription>
            Create your account for{" "}
            <span className="text-foreground">{invite.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm inviteToken={token} inviteEmail={invite.email} />
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

  const config = await getAuthConfig();
  if (!config.allowRegistration) {
    redirect("/login");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
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
