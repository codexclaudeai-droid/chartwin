import Link from 'next/link';
import { ForgotPasswordPanel } from './forgot-password-panel';

export default function ForgotPasswordPage() {
  return (
    <main className="page">
      <h1>Password recovery</h1>
      <p className="lede">
        Request a reset token, then set a new password. Production email delivery can plug into this flow later.
      </p>
      <ForgotPasswordPanel />
      <p className="notice">
        Remembered your password? <Link href="/login">Back to login</Link>
      </p>
    </main>
  );
}

