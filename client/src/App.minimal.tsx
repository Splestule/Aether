export default function MinimalApp() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f3f4f6', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '0.5rem', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%',
        margin: '1rem'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          textAlign: 'center', 
          marginBottom: '1.5rem',
          color: '#1f2937'
        }}>
          🚀 VR Flight Tracker
        </h1>
        
        <p style={{ 
          textAlign: 'center', 
          color: '#6b7280', 
          marginBottom: '1.5rem' 
        }}>
          React is working! This is a minimal test version.
        </p>
        
        <div style={{ 
          textAlign: 'center',
          padding: '1rem',
          backgroundColor: '#dbeafe',
          borderRadius: '0.5rem',
          color: '#1e40af'
        }}>
          ✅ Application is loading successfully!
        </div>
        
        <div style={{ 
          marginTop: '1rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          Backend: <a href="http://localhost:8080/health" target="_blank" style={{ color: '#3b82f6' }}>Check Status</a>
        </div>
      </div>
    </div>
  )
}
