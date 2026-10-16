import type { Participant } from '../domain/participant';
import type { CertificateRenderer, RenderRequest } from './ports';

/** A real certificate for one participant, exactly as it will be generated. */
export async function buildPreview(
  request: RenderRequest & { readonly participant: Participant },
  renderer: CertificateRenderer,
): Promise<Uint8Array> {
  const session = await renderer.prepare(request);
  const { bytes } = await session.renderDocument(request.participant);
  return bytes;
}
