.PHONY: build check dev isolated

build:
	pnpm build

check:
	pnpm check

dev:
	pnpm dev

# Claude's run: data, config and renderer port of its own, in a temp directory deleted on exit.
isolated:
	@dir=$$(mktemp -d -t perch-isolated.XXXXXX) || exit 1; \
	trap 'rm -rf "$$dir"' EXIT; trap 'exit 130' INT TERM; \
	PERCH_DATA_DIR="$$dir/data" PERCH_CONFIG="$$dir/config.toml" PERCH_RENDERER_PORT=5176 \
	pnpm --filter @perch/desktop exec electron-vite dev
