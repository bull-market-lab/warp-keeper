import dotenv from 'dotenv';
import { env } from 'process';

dotenv.config();

export const LCD_ENDPOINT: string = env.LCD_ENDPOINT!;
export const WEBSOCKET_ENDPOINT: string = env.WEBSOCKET_ENDPOINT!;
export const CHAIN_ID: string = env.CHAIN_ID!;
// MNEMONIC_KEY of the account use by bot
export const MNEMONIC_KEY: string = env.MNEMONIC_KEY!;
// MNEMONIC_KEY of the account use by tester, tester will create job for bot to execute
export const TESTER_MNEMONIC_KEY: string = env.TESTER_MNEMONIC_KEY!;

export const WARP_CONTROLLER_ADDRESS: string | undefined = env.WARP_CONTROLLER_ADDRESS;
export const WARP_RESOLVER_ADDRESS: string | undefined = env.WARP_RESOLVER_ADDRESS;

export const SETTEN_PROJECT: string | undefined = env.SETTEN_PROJECT;
export const SETTEN_KEY: string | undefined = env.SETTEN_KEY;

export const ENABLE_SKIP: boolean = env.ENABLE_SKIP === 'true';
export const SKIP_RPC_ENDPOINT: string | undefined = env.SKIP_RPC_ENDPOINT;

export const ENABLE_SENTRY: boolean = env.ENABLE_SENTRY === 'true';
export const SENTRY_DSN: string = env.SENTRY_DSN!;

export const REDIS_ENDPOINT: string = env.REDIS_ENDPOINT!;

export const MIN_REWARD: number = parseInt(env.MIN_REWARD!);
