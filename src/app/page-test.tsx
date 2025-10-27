export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ChatSphere - Next.js App
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          This is a test to verify Next.js deployment works on Vercel.
        </p>
        <div className="space-y-4">
          <a 
            href="/api/health" 
            className="block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Test API Health Check
          </a>
          <a 
            href="/home" 
            className="block bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors"
          >
            Go to Home Page
          </a>
        </div>
      </div>
    </div>
  );
}
