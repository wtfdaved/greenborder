import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-12 px-6 bg-white dark:bg-black sm:items-start">
        <div className="w-full">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            Welcome to Greenborder
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {userId ? (
              <span>
                You are signed in! Explore the premium features or manage your account.
              </span>
            ) : (
              <span>
                Sign in or create an account to access premium features.
              </span>
            )}
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          {/* Public Routes */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-green-700">📖 Public Routes</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-blue-600 hover:underline font-medium"
                >
                  / - Homepage
                </Link>
                <p className="text-xs text-gray-500">Always accessible</p>
              </li>
              <li>
                <Link
                  href="/articles"
                  className="text-blue-600 hover:underline font-medium"
                >
                  /articles - Articles
                </Link>
                <p className="text-xs text-gray-500">Always accessible</p>
              </li>
            </ul>
          </div>

          {/* Protected Routes */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-purple-700">🔒 Protected Routes</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/premium"
                  className="text-blue-600 hover:underline font-medium"
                >
                  /premium - Premium Features
                </Link>
                <p className="text-xs text-gray-500">
                  {userId ? "✓ You can access this" : "Sign in to access"}
                </p>
              </li>
              <li>
                <Link
                  href="/signin"
                  className="text-blue-600 hover:underline font-medium"
                >
                  /signin - Sign In
                </Link>
                <p className="text-xs text-gray-500">Full Clerk form</p>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="text-blue-600 hover:underline font-medium"
                >
                  /signup - Sign Up
                </Link>
                <p className="text-xs text-gray-500">Full Clerk form</p>
              </li>
            </ul>
          </div>
        </div>

        {/* Status Box */}
        <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <h3 className="font-semibold text-blue-900 mb-2">Authentication Status</h3>
          <p className="text-blue-800">
            {userId ? (
              <>
                ✓ <span className="font-medium">Signed in</span> (User ID: {userId})
              </>
            ) : (
              <>
                ○ <span className="font-medium">Not signed in</span> - Use the header to sign in
              </>
            )}
          </p>
        </div>

        {/* Features */}
        <div className="w-full mt-12">
          <h2 className="text-2xl font-bold mb-6 text-black dark:text-zinc-50">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="text-2xl mb-2">🔐</div>
              <h3 className="font-semibold mb-1">Secure Auth</h3>
              <p className="text-sm text-gray-700">
                Powered by Clerk for enterprise-grade authentication
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
              <div className="text-2xl mb-2">⚙️</div>
              <h3 className="font-semibold mb-1">Protected Routes</h3>
              <p className="text-sm text-gray-700">
                /premium route is protected and only accessible to authenticated users
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <div className="text-2xl mb-2">🚀</div>
              <h3 className="font-semibold mb-1">Next.js 16</h3>
              <p className="text-sm text-gray-700">
                Built with the latest Next.js App Router and proxy
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
