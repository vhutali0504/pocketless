import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import { CardsProvider, useCards } from './context/CardsContext.jsx';
import WalletPage from './pages/app/WalletPage.jsx';
import CardDetailsPage from './pages/app/CardDetailsPage.jsx';
import StorageUnavailable from './pages/app/StorageUnavailable.jsx';
import AddCardPage from './pages/app/add/AddCardPage.jsx';

/** Every /app route needs storage: without it, they all show the same explanation. */
function StorageGate() {
  const { status } = useCards();
  return status === 'unavailable' ? <StorageUnavailable /> : <Outlet />;
}

function AppShell() {
  return (
    <ErrorBoundary>
      <CardsProvider>
        <StorageGate />
      </CardsProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<WalletPage />} />
        <Route path="add" element={<AddCardPage />} />
        <Route path="cards/:id" element={<CardDetailsPage />} />
      </Route>
    </Routes>
  );
}
