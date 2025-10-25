import { useState } from 'react'

function SimpleApp() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          🚀 VR Flight Tracker
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Application is working! This is a simplified version for testing.
        </p>
        
        <div className="text-center mb-6">
          <button
            onClick={() => setCount(count + 1)}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Test Button: {count}
          </button>
        </div>
        
        <div className="text-sm text-gray-500 text-center space-y-2">
          <div>✅ React is working!</div>
          <div>✅ TailwindCSS is working!</div>
          <div>✅ TypeScript is working!</div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Next Steps:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Click on the map to select your location</li>
            <li>• View aircraft in 3D space around you</li>
            <li>• Click on aircraft for detailed information</li>
            <li>• Enter VR mode for immersive experience</li>
          </ul>
        </div>
        
        <div className="mt-4 text-center">
          <a 
            href="http://localhost:8080/health" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Check Backend Status →
          </a>
        </div>
      </div>
    </div>
  )
}

export default SimpleApp
