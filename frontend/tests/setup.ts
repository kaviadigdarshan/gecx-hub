import "@testing-library/jest-dom";

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(8),
}) as unknown as typeof fetch