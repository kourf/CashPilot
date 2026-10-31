import AppRouter from './Router';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { TransactionsProvider } from './context/TransactionsContext';
import { ReceiptsProvider } from './context/ReceiptsContext';
import { CoachProvider } from './context/CoachContext';

function App() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <ErrorBoundary>
        <AuthProvider>
          <TransactionsProvider>
            <ReceiptsProvider>
              <CoachProvider>
                <AppRouter />
              </CoachProvider>
            </ReceiptsProvider>
          </TransactionsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </div>
  );
}

export default App;
