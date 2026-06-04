import { NextResponse } from 'next/server.js';
import {
  getWebPushPublicKey,
  isWebPushConfigured,
} from '../../../../src/server/chart-service/index.ts';

export async function GET() {
  const publicKey = getWebPushPublicKey();

  return NextResponse.json({
    ok: Boolean(publicKey),
    enabled: isWebPushConfigured(),
    publicKey,
  });
}
