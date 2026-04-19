import { runDoctor, type DoctorTarget } from '../engine/doctor/index.js';

export async function doctor() {
  try {
    const target = normalizeTarget(process.argv[3]);
    const ok = await runDoctor(target);

    if (!ok) {
      process.exit(1);
    }
  } catch (error: unknown) {
    console.error('❌ Something went wrong:', error);
    process.exit(1);
  }
}

function normalizeTarget(value?: string): DoctorTarget | undefined {
  if (value === 'node' || value === 'android' || value === 'backend') {
    return value;
  }

  if (!value) {
    return undefined;
  }

  throw new Error(`Unsupported doctor target: ${value}`);
}
