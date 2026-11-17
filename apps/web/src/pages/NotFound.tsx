import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

export function NotFound() {
  const { session } = useAuth();
  return (
    <section className='not-found-page'>
      <div className='not-found-flex-2'>
        <Compass className='not-found-h-7-1' />
      </div>
      <h1 className='not-found-mt-5-1'>Page not found</h1>
      <p className='not-found-mt-2-1'>
        The page you are looking for does not exist or you do not have access to it.
      </p>
      <Link to={session ? '/dashboard' : '/'} className='not-found-mt-6-1'>
        <Button>{session ? 'Go to dashboard' : 'Back to home'}</Button>
      </Link>
    </section>
  );
}
