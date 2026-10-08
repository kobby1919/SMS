export default function FollowUpLoading() {
  return <div role="status" aria-live="polite" className="space-y-4 p-4 md:p-6">
    <p className="text-sm text-gray-600">Loading teacher follow-ups...</p>
    {[1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />)}
  </div>;
}
