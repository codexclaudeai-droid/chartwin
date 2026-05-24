'use client';

import { useState, type KeyboardEvent } from 'react';
import {
  getAdminActionConfirmationDetails,
  type AdminActionConfirmationDetails,
} from './admin-action-confirmation';

type PendingConfirmation = {
  details: AdminActionConfirmationDetails;
  resolve: (allowed: boolean) => void;
};

type AdminActionConfirmationDialogProps = {
  details: AdminActionConfirmationDetails;
  onApprove: () => void;
  onCancel: () => void;
};

export function useAdminActionConfirmation() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  function confirmAdminAction(action: string, targetLabel: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setPending({
        details: getAdminActionConfirmationDetails(action, targetLabel),
        resolve,
      });
    });
  }

  function approvePending() {
    if (!pending) return;

    pending.resolve(true);
    setPending(null);
  }

  function cancelPending() {
    if (!pending) return;

    pending.resolve(false);
    setPending(null);
  }

  const confirmationDialog = pending ? (
    <AdminActionConfirmationDialog
      details={pending.details}
      onApprove={approvePending}
      onCancel={cancelPending}
    />
  ) : null;

  return { confirmAdminAction, confirmationDialog };
}

function AdminActionConfirmationDialog({
  details,
  onApprove,
  onCancel,
}: AdminActionConfirmationDialogProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div className="admin-confirmation-backdrop" data-admin-action-confirmation>
      <section
        aria-describedby="admin-confirmation-description"
        aria-modal="true"
        className="admin-confirmation-dialog"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <div className="admin-confirmation-kicker">관리자 작업 확인</div>
        <h2>{details.title}</h2>
        <p id="admin-confirmation-description">{details.description}</p>
        <div className="admin-confirmation-summary">
          <span>작업</span>
          <strong>{details.actionLabel}</strong>
          <span>대상</span>
          <strong>{details.targetLabel}</strong>
        </div>
        <div className="actions">
          <button className="button danger" type="button" onClick={onApprove}>
            작업 진행
          </button>
          <button autoFocus className="button secondary" type="button" onClick={onCancel}>
            취소
          </button>
        </div>
      </section>
    </div>
  );
}
