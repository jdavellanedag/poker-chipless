export function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}
