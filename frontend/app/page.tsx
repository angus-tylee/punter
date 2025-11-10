export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to Punter
        </h1>
        <p className="text-center text-lg mb-4">
          Your full-stack application is ready!
        </p>
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Stack: Next.js + TypeScript + FastAPI + Supabase
          </p>
        </div>
      </div>
    </main>
  );
}

