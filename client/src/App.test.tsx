import { useState } from 'react'

function TestApp() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          🚀 VR Flight Tracker
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Application is loading...
        </p>
        <div className="text-center">
          <button
            onClick={() => setCount(count + 1)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Button: {count}
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-500 text-center">
          If you can see this, React is working!
        </div>
      </div>
    </div>
  )
}

export default TestApp
