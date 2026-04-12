export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-3xl px-6 py-6">{children}</div>
    </div>
  );
}
