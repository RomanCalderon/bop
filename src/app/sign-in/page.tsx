import { SignInButton } from "@/components/sign-in-button";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Bop</h1>
      <p className="text-stone-600">
        For when you are bopping around town from place to place.
      </p>
      <SignInButton />
    </main>
  );
}
