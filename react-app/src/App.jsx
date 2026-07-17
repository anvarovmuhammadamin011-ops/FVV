import { useApp } from './AppContext.jsx';
import LoginPage from './components/LoginPage.jsx';
import WorkerApp from './worker/WorkerApp.jsx';
import AdminApp from './admin/AdminApp.jsx';
import MasterApp from './admin/MasterApp.jsx';
import PhotoModal from './components/PhotoModal.jsx';

export default function App() {
  const { session } = useApp();

  let page;
  if (!session) page = <LoginPage />;
  else if (session.role === 'worker' || session.role === 'inspektor') page = <WorkerApp />;
  else if (session.role === 'master') page = <MasterApp />;
  else page = <AdminApp />;

  return (
    <>
      {page}
      <PhotoModal />
    </>
  );
}
