"use client";

import { UserButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function HeaderAuth() {
  const { isSignedIn } = useAuth();

  return (
    <div className="flex items-center gap-4">
      {isSignedIn && (
        <Link
          href="/premium"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          Premium
        </Link>
      )}
      <div className="flex items-center gap-3">
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <>
            <Link
              href="/signin"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
