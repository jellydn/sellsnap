import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

interface PurchaseData {
  productTitle: string;
  downloadToken: string;
}

export function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseData | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      setLoading(false);
      return;
    }

    fetch(`/api/purchases/by-session/${sessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Purchase not found" }));
          throw new Error(err.error || "Purchase not found");
        }
        return res.json();
      })
      .then(setPurchase)
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h1 className="text-2xl font-bold">Purchase Not Found</h1>
        <p className="text-gray-500">{error || "We couldn't find this purchase."}</p>
        <Link to="/" className="text-blue-500 hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Thank you for your purchase!</h1>
        <p className="text-gray-600">You have purchased: {purchase.productTitle}</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Download Your File</h2>
        <p className="text-sm text-gray-600 mb-4">Your download link will expire in 24 hours.</p>
        <a
          href={`/api/download/${purchase.downloadToken}`}
          className="inline-block py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg"
        >
          Download Now
        </a>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        A confirmation email has been sent with your download link.
      </p>
    </div>
  );
}
