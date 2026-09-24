export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <div className="skeleton h-5 w-56 rounded-lg" />
          <div className="skeleton h-3 w-72 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-72 w-full rounded-2xl lg:col-span-2" />
        <div className="skeleton h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
