import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { JoinAction } from "./join-action";

interface InviteInfo {
  type: "collection";
  target: {
    id: string;
    name: string;
    owner: string;
  };
  alreadyMember?: boolean;
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=/join/${token}`);
  }

  let invite: InviteInfo | null = null;
  let error = "";

  try {
    invite = await apiFetch<InviteInfo>("GET", `/join/${token}`);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="flex min-h-screen items-start justify-center pt-[20vh]">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        {error ? (
          <div className="space-y-2 text-center">
            <h1 className="text-xl font-bold">Invalid invite link</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : invite ? (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-bold">
                {invite.alreadyMember
                  ? `Already a member`
                  : `Join collection`}
              </h1>
              <p className="text-muted-foreground">
                {invite.alreadyMember ? (
                  <>
                    You are already a member of{" "}
                    <span className="font-semibold text-foreground">
                      {invite.target.name}
                    </span>
                  </>
                ) : (
                  <>
                    You&apos;ve been invited to join{" "}
                    <span className="font-semibold text-foreground">
                      {invite.target.name}
                    </span>
                  </>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Signed in as {user.email}
              </p>
            </div>
            {invite.alreadyMember ? (
              <Link
                href={`/${encodeURIComponent(invite.target.owner)}/${encodeURIComponent(invite.target.name)}`}
                className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to {invite.target.name}
              </Link>
            ) : (
              <JoinAction token={token} target={invite.target} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
