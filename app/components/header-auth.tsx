"use client";

import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";

export default function HeaderAuth() {
  const { isSignedIn } = useAuth();

  return (
    <div className="flex items-center gap-3">
      {isSignedIn ? (
        <UserButton />
      ) : (
        <>
          <SignInButton>
            <button className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors">
              Sign up
            </button>
          </SignUpButton>
        </>
      )}
    </div>
  );
}
