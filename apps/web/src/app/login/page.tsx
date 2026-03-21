import { LoginForm } from "@/components/login-form";

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

export default async function LoginPage() {
  const config = await getAuthConfig();

  return (
    <div className="max-w-sm mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6 text-center">Sign in</h1>
      <LoginForm googleOAuth={config.googleOAuth} />
      {config.allowRegistration && (
        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-gray-900 hover:underline">
            Register
          </a>
        </p>
      )}
    </div>
  );
}
