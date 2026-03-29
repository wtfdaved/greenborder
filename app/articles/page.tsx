import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Articles",
  description: "Browse our collection of articles",
};

const articles = [
  {
    id: 1,
    title: "Getting Started with Clerk Authentication",
    description: "Learn how to integrate Clerk into your Next.js application for secure authentication.",
    date: "March 29, 2026",
  },
  {
    id: 2,
    title: "Protecting Routes in Next.js App Router",
    description: "Discover how to create protected routes and restrict access to authenticated users only.",
    date: "March 28, 2026",
  },
  {
    id: 3,
    title: "Best Practices for User Management",
    description: "Explore best practices for managing user accounts and authentication flows.",
    date: "March 27, 2026",
  },
  {
    id: 4,
    title: "Building Secure Web Applications",
    description: "Learn security principles and best practices for building secure web applications.",
    date: "March 26, 2026",
  },
];

export default function ArticlesPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Articles</h1>
        <p className="text-gray-600">
          This page is <span className="font-semibold">publicly accessible</span> - no authentication required.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {articles.map((article) => (
          <article
            key={article.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{article.title}</h2>
              <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">{article.date}</span>
            </div>
            <p className="text-gray-600 mb-4">{article.description}</p>
            <Link href={`/articles/${article.id}`} className="text-blue-600 hover:underline font-medium">
              Read more →
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Route Access</h3>
        <p className="text-blue-800">
          This page is part of the public content. Visit <Link href="/" className="font-medium underline">/</Link> to see
          more information about public and protected routes.
        </p>
      </div>
    </div>
  );
}
