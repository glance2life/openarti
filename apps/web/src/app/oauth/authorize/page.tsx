import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OAuthConsent } from "./oauth-consent";

interface Props {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    state?: string;
    code_challenge?: string;
    scope?: string;
  }>;
}

export default async function OAuthAuthorizePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    // Redirect to login with callback to this page
    const callbackUrl = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div className="flex min-h-screen items-start justify-center pt-[15vh]">
      <OAuthConsent
        clientId={params.client_id || ""}
        redirectUri={params.redirect_uri || ""}
        state={params.state || ""}
        codeChallenge={params.code_challenge || ""}
        scope={params.scope || ""}
        userName={user.name}
      />
    </div>
  );
}
