VERSION ?=

.PHONY: release

release:
	@if [ -z "$(VERSION)" ]; then \
		echo "Error: missing version. Usage: make release VERSION=x.y.z"; \
		exit 1; \
	fi
	@if git tag -l | grep -qx "v$(VERSION)"; then \
		echo "Error: tag v$(VERSION) already exists"; \
		exit 1; \
	fi
	@sed -i "s/'version' => '[^']*'/'version' => '$(VERSION)'/" config/app.php
	@git add config/app.php
	@git commit -m "Release v$(VERSION)"
	@git push
	@git tag "v$(VERSION)"
	@git push --tags
	@echo "Released v$(VERSION)"