import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { CardsProvider } from './context/CardsContext.jsx';
import WalletPage from './pages/app/WalletPage.jsx';

function AppShell() {
  return (
    <CardsProvider>
      <Outlet />
    </CardsProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<WalletPage />} />
      </Route>
    </Routes>
  );
}
