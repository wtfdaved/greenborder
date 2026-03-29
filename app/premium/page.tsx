import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium",
  description: "Premium features for authenticated users",
};

export default async function PremiumPage() {
  const { userId, sessionId } = await auth();

  if (!userId) {
    redirect("/signin");
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-4xl font-bold mb-4">Premium Features</h1>
        <p className="text-gray-600 mb-6">
          Welcome to the premium section. This page is protected and only accessible to
          authenticated users.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Advanced Analytics</h2>
            <p className="text-gray-700">
              Detailed insights and metrics available exclusively for premium members.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Priority Support</h2>
            <p className="text-gray-700">
              Get dedicated support with faster response times for your questions.
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Unlimited Access</h2>
            <p className="text-gray-700">
              Unlock all features without any usage limits or restrictions.
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Custom Integrations</h2>
            <p className="text-gray-700">
              Connect with your favorite tools and services seamlessly.
            </p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">User ID:</span> {userId}
          </p>
        </div>
      </div>
    </div>
  );
}
