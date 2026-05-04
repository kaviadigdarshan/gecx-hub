// frontend/src/pages/NotFoundPage.tsx
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-body">
      <p className="text-5xl font-bold text-gecx-600">404</p>
      <p className="text-gray-500 text-sm">Page not found.</p>
      <Link to="/" className="text-gecx-600 underline text-sm">
        Back to Dashboard
      </Link>
    </div>
  );
}