import './App.css';

function DashboardPage() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome, Admin!</p>
        <p>This page is only visible to users in the 'Admins' group.</p>
      </header>
    </div>
  );
}

export default DashboardPage;
