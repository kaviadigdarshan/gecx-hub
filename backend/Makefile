.PHONY: test test-unit test-contract test-cov

test-unit:
	pytest tests/ -m "not contract" -q

test-contract:
	pytest tests/ -m contract -q --tb=short

test-cov:
	pytest tests/ -m "not contract" \
		--cov \
		--cov-report=term-missing \
		--cov-report=html \
		-q

test: test-unit test-contract
