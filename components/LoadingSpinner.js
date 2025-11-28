import { Spinner } from 'react-bootstrap';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-spinner">
      <div className="text-center">
        <Spinner animation="border" role="status" variant="primary" />
        <p className="mt-3 text-muted">{message}</p>
      </div>
    </div>
  );
}
