.PHONY: publish

publish:
	git add source/*.md
	git commit -m "Update chapters"
	gpa git push
