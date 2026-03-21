import { SettingsNav } from "@/components/settings-nav";

export default async function SettingsLayout({
  params,
  children,
}: {
  params: Promise<{ team: string }>;
  children: React.ReactNode;
}) {
  const { team } = await params;

  return (
    <div className="flex -mx-8 -my-8 min-h-full">
      <SettingsNav team={team} />
      <div className="flex-1 py-8 pr-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
