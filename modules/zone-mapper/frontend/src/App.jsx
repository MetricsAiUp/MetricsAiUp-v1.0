import { StoreProvider } from './store/useStore';
import Layout from './components/Layout/Layout';

export default function App() {
  return (
    <StoreProvider>
      <Layout />
    </StoreProvider>
  );
}
