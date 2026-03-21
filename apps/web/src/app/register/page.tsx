import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/register-form";

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

  // Only allow registration if enabled or user has invite token
  if (!config.allowRegistration && !params.token) {
    redirect("/login");
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6 text-center">Create account</h1>
      <RegisterForm inviteToken={params.token} />
      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <a href="/login" className="text-gray-900 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
