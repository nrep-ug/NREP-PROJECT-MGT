'use client';

import { useState, useEffect } from 'react';
import { Toast as BSToast, ToastContainer } from 'react-bootstrap';

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant });
  };

  const hideToast = () => {
    setToast(null);
  };

  return { toast, showToast, hideToast };
}

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
      <BSToast
        show={!!toast}
        onClose={onClose}
        delay={3000}
        autohide
        bg={toast.variant}
      >
        <BSToast.Header>
          <strong className="me-auto">
            {toast.variant === 'success' ? 'Success' : toast.variant === 'danger' ? 'Error' : 'Info'}
          </strong>
        </BSToast.Header>
        <BSToast.Body className={toast.variant === 'success' || toast.variant === 'danger' ? 'text-white' : ''}>
          {toast.message}
        </BSToast.Body>
      </BSToast>
    </ToastContainer>
  );
}
