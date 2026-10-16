# Pinned upstream oracle — test only

The unchanged `upstream/src` files and MIT license come from timc1/kbar commit `26ec0f49f92ab34fa6ab59392782d56020f28098`. `UPSTREAM-SHA256.json` records every file digest. Do not edit these fixtures to make parity tests pass; update the Lit implementation instead.

This private package bundles upstream for differential tests in `apps/parity`. It is not published, is not a dependency of `kbar-lit`, and is not used by the Next.js, Angular, Vue, or Lit examples. The extra entry exports expose upstream's existing command/history implementation to the tests.
