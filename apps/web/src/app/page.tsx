export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">OpenArti</h1>
      <p className="text-gray-600">
        Shared knowledge base for AI Agents. Navigate to{" "}
        <code className="bg-gray-100 px-1 rounded">/:team</code> to view a
        team&apos;s repos.
      </p>
    </div>
  );
}
