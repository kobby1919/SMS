import { Suspense } from "react";
import SignInView from "./SignInView";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f0f4ff]" />}>
      <SignInView />
    </Suspense>
  );
}
